const axios = require("axios");
const City = require("../models/City");

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "sk.eyJ1IjoiaHVsemVyNCIsImEiOiJjbWhxZHBlZ20wbjR6MmxxY3lweGt3ZXRqIn0.psXEo77gaQPa1eyRzS3NnA";

// Mapeamento de cityId para coordenadas (pode ser movido para banco de dados no futuro)
const CITY_COORDINATES = {
  "araruama-rj": { lat: -22.8697, lng: -42.3311, name: "Araruama" },
  "campinas": { lat: -22.9099, lng: -47.0626, name: "Campinas" },
  "piracicaba": { lat: -22.7253, lng: -47.6492, name: "Piracicaba" },
};

/**
 * GET /api/geocoding/reverse
 * Faz geolocalização reversa usando Mapbox
 * Query params: lat, lng
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Latitude e longitude são obrigatórios.",
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        message: "Latitude e longitude devem ser números válidos.",
      });
    }

    // Chama a API do Mapbox para geolocalização reversa
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngNum},${latNum}.json`;
    
    const response = await axios.get(mapboxUrl, {
      params: {
        access_token: MAPBOX_ACCESS_TOKEN,
        limit: 5, // Limita a 5 resultados
        language: "pt-BR", // Português do Brasil
        types: "address,poi", // Apenas endereços e pontos de interesse
        // Inclui mais contexto na resposta para melhor extração de bairro
      },
    });

    const results = response.data.features.map((feature, index) => {
      const context = feature.context || [];
      
      // Log de debug (apenas para o primeiro resultado)
      if (index === 0) {
        console.log("🔍 Debug - Contexto do Mapbox:", JSON.stringify(context.map(c => ({
          id: c.id,
          text: c.text,
          type: c.id.split(".")[0]
        })), null, 2));
      }
      
      // Extrai informações do contexto do Mapbox
      let bairro = null;
      let rua = null;
      let numero = null;
      let complemento = null;
      let cidade = null;
      let estado = null;

      // O Mapbox retorna contexto em ordem hierárquica
      // Tipos possíveis: neighborhood, locality, place, district, address, postcode, region, country
      context.forEach((item) => {
        const id = item.id;
        const idParts = id.split(".");
        
        // Bairro pode vir como neighborhood, district ou locality (dependendo da região)
        if (idParts[0] === "neighborhood" || idParts[0] === "district") {
          bairro = item.text;
        }
        // Se não encontrou bairro, tenta locality (pode ser bairro em algumas cidades)
        if (!bairro && idParts[0] === "locality" && !cidade) {
          // Verifica se é realmente um bairro ou cidade pelo tamanho do nome
          // Bairros geralmente são menores que cidades
          const text = item.text;
          if (text && text.length < 30) {
            bairro = text;
          } else {
            cidade = text;
          }
        }
        // Cidade
        if (idParts[0] === "place" && !cidade) {
          cidade = item.text;
        }
        // Estado/Região
        if (idParts[0] === "region") {
          estado = item.text;
        }
        // Endereço/Rua
        if (idParts[0] === "address") {
          rua = item.text;
        }
      });

      // Tenta extrair número e rua do texto principal (feature.text)
      const addressText = feature.text || "";
      const fullAddress = feature.place_name || "";

      // Extrai número do início do endereço se existir
      const numeroMatch = addressText.match(/^(\d+)/);
      if (numeroMatch) {
        numero = numeroMatch[1];
      }

      // Se não encontrou rua no contexto, tenta extrair do texto
      if (!rua && addressText) {
        // Remove o número se existir no início
        rua = addressText.replace(/^\d+\s*[-,\s]*/, "").trim();
      }

      // Se ainda não encontrou rua, tenta extrair do place_name
      if (!rua && fullAddress) {
        // Tenta extrair a rua antes da primeira vírgula
        const parts = fullAddress.split(",");
        if (parts.length > 0) {
          const firstPart = parts[0].trim();
          // Remove número se existir
          rua = firstPart.replace(/^\d+\s*[-,\s]*/, "").trim();
        }
      }

      // Tenta extrair bairro do endereço formatado se não encontrou no contexto
      if (!bairro && fullAddress) {
        // Padrão brasileiro comum: "Rua X, 123, Bairro Y, Cidade - Estado, CEP"
        // Ou: "Rua X, Bairro Y, Cidade - Estado"
        const parts = fullAddress.split(",").map(p => p.trim());
        
        // Normalmente o bairro vem após a rua/número e antes da cidade
        // Exemplo: ["Rua X 123", "Bairro Y", "Cidade - Estado", "CEP"]
        if (parts.length >= 3) {
          // Pula a primeira parte (rua/número) e verifica a segunda
          const possibleBairro = parts[1];
          
          // Verifica se não é cidade-estado (contém " - " ou é muito longo)
          const isCityState = possibleBairro.includes(" - ") || 
                             possibleBairro.match(/^[A-Z][a-z]+ - [A-Z][a-z]+/);
          
          // Verifica se não é número, CEP, estado ou cidade-estado
          if (possibleBairro && 
              !possibleBairro.match(/^\d+/) && 
              !possibleBairro.match(/^\d{5}-?\d{3}/) &&
              !possibleBairro.match(/^[A-Z]{2}$/) &&
              !isCityState &&
              possibleBairro.length > 2 &&
              possibleBairro.length < 50 &&
              // Não deve conter palavras comuns de cidade/estado
              !possibleBairro.match(/^(Brasil|Brazil)$/i)) {
            bairro = possibleBairro;
          }
        }
        
        // Se ainda não encontrou, tenta padrão alternativo com mais partes
        if (!bairro && parts.length >= 4) {
          // Tenta a terceira parte se a segunda for cidade-estado
          const secondPart = parts[1];
          const isCityState = secondPart.includes(" - ");
          
          if (isCityState && parts[2]) {
            const possibleBairro = parts[2];
            if (possibleBairro && 
                !possibleBairro.match(/^\d+/) && 
                !possibleBairro.match(/^\d{5}-?\d{3}/) &&
                possibleBairro.length > 2 &&
                possibleBairro.length < 50) {
              bairro = possibleBairro;
            }
          }
        }
      }

      return {
        address: fullAddress,
        bairro: bairro || null,
        rua: rua || null,
        numero: numero || null,
        complemento: complemento || null,
        cidade: cidade || null,
        estado: estado || null,
        formattedAddress: fullAddress,
        // Retorna também os dados brutos para debug se necessário
        _raw: {
          text: addressText,
          place_name: fullAddress,
          context_types: context.map(c => c.id.split(".")[0]),
        },
      };
    });

    return res.status(200).json({
      results,
    });
  } catch (error) {
    console.error("❌ Erro ao fazer geolocalização reversa:", error);
    
    if (error.response) {
      return res.status(error.response.status || 500).json({
        message: "Erro ao buscar endereços.",
        error: error.response.data?.message || error.message,
      });
    }

    return res.status(500).json({
      message: "Erro interno ao fazer geolocalização reversa.",
    });
  }
};

/**
 * GET /api/geocoding/search
 * Busca endereços usando Mapbox (forward geocoding)
 * Query params: q (query string), limit (opcional, default 5), cityId (opcional)
 * Suporta busca por CEP, endereço, rua, bairro, etc.
 * Se cityId for fornecido, filtra resultados para a cidade selecionada
 */
exports.searchAddresses = async (req, res) => {
  try {
    const { q, limit = 5, cityId } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        message: "Parâmetro 'q' (query) é obrigatório.",
      });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10) {
      return res.status(400).json({
        message: "Limit deve ser um número entre 1 e 10.",
      });
    }

    // Normalizar CEP (remover hífen e espaços)
    const normalizedQuery = q.trim().replace(/[-\s]/g, "");
    
    // Verificar se é um CEP (8 dígitos)
    const isCEP = /^\d{8}$/.test(normalizedQuery);
    
    // Inicializar variáveis
    let mapboxResults = [];
    let viaCepResult = null;

    // Se for CEP, tentar buscar primeiro na ViaCEP (API brasileira especializada em CEPs)
    if (isCEP) {
      try {
        const viaCepUrl = `https://viacep.com.br/ws/${normalizedQuery}/json/`;
        const viaCepResponse = await axios.get(viaCepUrl, { timeout: 3000 });
        
        if (viaCepResponse.data && !viaCepResponse.data.erro) {
          const cepData = viaCepResponse.data;
          
          // Formatar endereço completo
          const enderecoCompleto = `${cepData.logradouro || ""}, ${cepData.bairro || ""}, ${cepData.localidade || ""} - ${cepData.uf || ""}, ${normalizedQuery.slice(0, 5)}-${normalizedQuery.slice(5)}`;
          
          viaCepResult = {
            id: `viacep-${normalizedQuery}`,
            address: enderecoCompleto.trim().replace(/^,\s*/, ""),
            text: cepData.logradouro || cepData.bairro || cepData.localidade || "",
            bairro: cepData.bairro || null,
            rua: cepData.logradouro || null,
            cidade: cepData.localidade || null,
            estado: cepData.uf || null,
            cep: normalizedQuery,
            type: "postcode",
            coordinates: null, // ViaCEP não retorna coordenadas, vamos buscar depois
          };

          // Se temos endereço da ViaCEP, fazer geocodificação reversa no Mapbox para obter coordenadas
          if (cepData.logradouro && cepData.localidade) {
            try {
              const geocodeQuery = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade}, ${cepData.uf}, Brasil`;
              const mapboxGeocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(geocodeQuery)}.json`;
              
              const geocodeResponse = await axios.get(mapboxGeocodeUrl, {
                params: {
                  access_token: MAPBOX_ACCESS_TOKEN,
                  limit: 1,
                  language: "pt-BR",
                  country: "BR",
                },
              });

              if (geocodeResponse.data.features && geocodeResponse.data.features.length > 0) {
                const [lng, lat] = geocodeResponse.data.features[0].center || geocodeResponse.data.features[0].geometry.coordinates;
                viaCepResult.coordinates = {
                  lat: parseFloat(lat),
                  lng: parseFloat(lng),
                };
              }
            } catch (geocodeError) {
              console.log("⚠️ Erro ao geocodificar endereço da ViaCEP:", geocodeError.message);
              // Continuar sem coordenadas
            }
          }
        }
      } catch (viaCepError) {
        console.log("⚠️ Erro ao buscar CEP na ViaCEP:", viaCepError.message);
        // Continuar com busca no Mapbox
      }
    }

    // Buscar também no Mapbox (para ter mais opções e coordenadas precisas)
    let searchQuery = q;
    if (isCEP) {
      // Para Mapbox, usar o CEP formatado
      searchQuery = `${normalizedQuery.slice(0, 5)}-${normalizedQuery.slice(5)}`;
    }

    // Determinar tipos de busca baseado na query
    let types = "address,poi"; // Padrão: endereços e pontos de interesse
    
    // Se for CEP, buscar por postcode e address
    if (isCEP) {
      types = "postcode,address";
    } else if (normalizedQuery.length <= 3) {
      // Se for muito curto, buscar tudo
      types = "address,poi,place,neighborhood";
    }

    // Buscar informações da cidade se cityId foi fornecido
    let cityInfo = null;
    let cityName = null;
    if (cityId) {
      console.log(`🔍 Buscando informações da cidade: ${cityId}`);
      
      // Tentar buscar do banco de dados primeiro
      try {
        const city = await City.findOne({ id: cityId }).lean();
        if (city) {
          cityName = city.label;
          console.log(`✅ Cidade encontrada no banco: ${cityName}`);
        }
      } catch (error) {
        console.log("⚠️ Erro ao buscar cidade do banco:", error.message);
      }
      
      // Sempre buscar coordenadas do mapeamento estático (mesmo se encontrou no banco)
      if (CITY_COORDINATES[cityId]) {
        cityInfo = CITY_COORDINATES[cityId];
        if (!cityName) {
          cityName = cityInfo.name;
        }
        console.log(`✅ Coordenadas encontradas no mapeamento estático: ${cityName} (${cityInfo.lat}, ${cityInfo.lng})`);
      }
      
      if (!cityName) {
        console.log(`⚠️ Cidade não encontrada para cityId: ${cityId}`);
      } else if (!cityInfo) {
        console.log(`⚠️ Coordenadas não encontradas para cityId: ${cityId}`);
      }
    } else {
      console.log("⚠️ cityId não fornecido na requisição");
    }

    // Preparar parâmetros do Mapbox
    const mapboxParams = {
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: limitNum * 2, // Buscar mais resultados para filtrar depois
      language: "pt-BR",
      types: types,
      country: "BR", // Limitar ao Brasil
    };

    // Se temos coordenadas da cidade, usar proximity para priorizar resultados próximos
    if (cityInfo) {
      // Mapbox usa formato [lng, lat] para proximity
      mapboxParams.proximity = `${cityInfo.lng},${cityInfo.lat}`;
    }

    try {
      // Chama a API do Mapbox para busca de endereços
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json`;
      
      const response = await axios.get(mapboxUrl, {
        params: mapboxParams,
      });

      mapboxResults = response.data.features || [];
    } catch (mapboxError) {
      console.log("⚠️ Erro ao buscar no Mapbox:", mapboxError.message);
      // Se for CEP e tivermos resultado da ViaCEP, usar apenas ele
      if (isCEP && viaCepResult) {
        return res.status(200).json({
          results: [viaCepResult],
        });
      }
      throw mapboxError;
    }

    // Processar resultados do Mapbox
    const mapboxProcessedResults = mapboxResults.map((feature) => {
      const context = feature.context || [];
      
      // Extrai informações do contexto
      let bairro = null;
      let rua = null;
      let cidade = null;
      let estado = null;
      let cep = null;

      // Verifica o tipo do resultado
      const featureType = feature.place_type?.[0] || feature.properties?.type || "";

      context.forEach((item) => {
        const id = item.id;
        const idParts = id.split(".");
        
        if (idParts[0] === "neighborhood" || idParts[0] === "district") {
          bairro = item.text;
        }
        if (idParts[0] === "place" && !cidade) {
          cidade = item.text;
        }
        if (idParts[0] === "region") {
          estado = item.text;
        }
        if (idParts[0] === "address") {
          rua = item.text;
        }
        if (idParts[0] === "postcode") {
          cep = item.text;
        }
      });

      // Se o resultado for um postcode (CEP), extrair informações do contexto
      if (featureType === "postcode" || feature.properties?.type === "postcode") {
        // Para CEP, tentar extrair cidade e estado do contexto
        context.forEach((item) => {
          const idParts = item.id.split(".");
          if (idParts[0] === "place" && !cidade) {
            cidade = item.text;
          }
          if (idParts[0] === "region") {
            estado = item.text;
          }
        });
        
        // CEP geralmente não tem rua específica, mas pode ter bairro
        const cepText = feature.text || feature.place_name || "";
        if (cepText && !cep) {
          // Tentar extrair CEP do texto
          const cepMatch = cepText.match(/\d{5}-?\d{3}/);
          if (cepMatch) {
            cep = cepMatch[0].replace("-", "");
          }
        }
      }

      // Se não encontrou rua no contexto, tentar extrair do texto
      if (!rua && feature.text && featureType !== "postcode") {
        // Remove números do início se existirem
        rua = feature.text.replace(/^\d+\s*[-,\s]*/, "").trim();
      }

      // Extrai coordenadas
      const [lng, lat] = feature.center || feature.geometry.coordinates;

      return {
        id: feature.id,
        address: feature.place_name || feature.text,
        text: feature.text,
        bairro: bairro || null,
        rua: rua || null,
        cidade: cidade || null,
        estado: estado || null,
        cep: cep || null,
        type: featureType, // Tipo do resultado (address, postcode, poi, etc.)
        coordinates: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        },
      };
    });

    // Combinar resultados: ViaCEP primeiro (se existir e for CEP), depois Mapbox
    let finalResults = [];
    
    if (viaCepResult && isCEP) {
      // Se for CEP e tivermos resultado da ViaCEP, verificar se é da cidade correta
      if (cityName && viaCepResult.cidade) {
        // Normalizar nomes para comparação (remover acentos, converter para minúsculas)
        const normalizeCityName = (name) => {
          return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
        };
        
        const viaCepCity = normalizeCityName(viaCepResult.cidade);
        const targetCity = normalizeCityName(cityName);
        
        // Se a cidade do ViaCEP corresponder à cidade selecionada, adicionar
        if (viaCepCity === targetCity || viaCepCity.includes(targetCity) || targetCity.includes(viaCepCity)) {
          finalResults.push(viaCepResult);
        }
      } else {
        // Se não temos cidade para filtrar, adicionar normalmente
        finalResults.push(viaCepResult);
      }
      
      // Adicionar resultados do Mapbox que não sejam duplicados (apenas se não tivermos resultado suficiente)
      if (finalResults.length < limitNum) {
        mapboxProcessedResults.forEach((mapboxResult) => {
          // Evitar duplicatas: se o CEP for o mesmo, pular
          const isDuplicate = mapboxResult.cep && 
                             viaCepResult.cep && 
                             mapboxResult.cep.replace(/[-\s]/g, "") === viaCepResult.cep.replace(/[-\s]/g, "");
          
          if (!isDuplicate && finalResults.length < limitNum) {
            finalResults.push(mapboxResult);
          }
        });
      }
    } else {
      // Se não for CEP ou não tivermos ViaCEP, usar apenas Mapbox
      finalResults = mapboxProcessedResults;
    }

    // Filtrar por cidade se cityName foi fornecido
    if (cityName && finalResults.length > 0) {
      const normalizeCityName = (name) => {
        if (!name) return "";
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      };
      
      // Função para calcular distância em km usando fórmula de Haversine
      const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371; // Raio da Terra em km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      
      const targetCity = normalizeCityName(cityName);
      
      // Filtrar e ordenar resultados por relevância
      const filteredAndScored = finalResults.map((result) => {
        let score = 0;
        let matchesCity = false;
        let distance = null;
        
        // Calcular distância geográfica primeiro
        if (cityInfo && result.coordinates) {
          distance = calculateDistance(
            cityInfo.lat,
            cityInfo.lng,
            result.coordinates.lat,
            result.coordinates.lng
          );
        }
        
        // Verificar correspondência por nome da cidade
        if (result.cidade) {
          const resultCity = normalizeCityName(result.cidade);
          if (resultCity === targetCity) {
            score += 100; // Máxima pontuação para correspondência exata
            matchesCity = true;
          } else if (resultCity.includes(targetCity) || targetCity.includes(resultCity)) {
            score += 50; // Pontuação média para correspondência parcial
            matchesCity = true;
          }
        }
        
        // Verificar proximidade geográfica (importante para rodovias que passam por várias cidades)
        // Se estiver dentro de 50km, considerar como válido mesmo sem correspondência de nome
        if (distance !== null) {
          if (distance <= 30) {
            score += 80;
            matchesCity = true; // Dentro de 30km, sempre considerar válido
          } else if (distance <= 50) {
            score += 40;
            matchesCity = true; // Dentro de 50km, considerar válido
          } else if (distance <= 100) {
            score += 10; // Entre 50-100km, pontuação baixa mas ainda pode ser útil
            // Não marcar como matchesCity aqui, mas manter no resultado se não houver outros melhores
          }
        }
        
        return { result, score, matchesCity, distance };
      });
      
      // Filtrar resultados: priorizar correspondência de cidade, mas incluir resultados próximos geograficamente
      // Ordenar por pontuação (mais relevante primeiro)
      const sortedResults = filteredAndScored.sort((a, b) => b.score - a.score);
      
      console.log(`📊 Resultados analisados:`, sortedResults.map(({ result, score, matchesCity, distance }) => ({
        cidade: result.cidade,
        score,
        matchesCity,
        distance: distance ? `${distance.toFixed(2)}km` : 'N/A'
      })));
      
      // Primeiro, verificar se temos resultados que correspondem à cidade por NOME
      const nameMatches = sortedResults.filter(({ matchesCity, result }) => {
        if (!matchesCity || !result.cidade) return false;
        const resultCity = normalizeCityName(result.cidade);
        return resultCity === targetCity || resultCity.includes(targetCity) || targetCity.includes(resultCity);
      });
      
      // Se temos correspondências por nome, usar apenas elas
      if (nameMatches.length > 0) {
        console.log(`✅ Encontrados ${nameMatches.length} resultados com correspondência de nome da cidade`);
        finalResults = nameMatches.map(({ result }) => result);
      } else {
        // Se não temos correspondência por nome, usar resultados próximos geograficamente (até 30km)
        // Ser mais restritivo para evitar resultados de cidades diferentes
        const nearbyFiltered = sortedResults
          .filter(({ matchesCity, distance }) => {
            // Incluir apenas se está dentro de 30km (mais restritivo)
            return distance !== null && distance <= 30;
          })
          .map(({ result }) => result);
        
        if (nearbyFiltered.length > 0) {
          console.log(`✅ Encontrados ${nearbyFiltered.length} resultados próximos geograficamente (até 30km)`);
          finalResults = nearbyFiltered;
        } else {
          // Se ainda não encontrou, expandir para 50km mas com menor prioridade
          const nearbyResults = sortedResults
            .filter(({ distance }) => distance !== null && distance <= 50)
            .slice(0, 3) // Limitar a 3 resultados mais próximos
            .map(({ result }) => result);
          
          if (nearbyResults.length > 0) {
            console.log(`⚠️ Nenhum resultado dentro de 30km, usando ${nearbyResults.length} resultados mais próximos (até 50km)`);
            finalResults = nearbyResults;
          } else {
            console.log(`⚠️ Nenhum resultado próximo encontrado para ${cityName}, retornando resultados originais`);
          }
        }
      }
    } else {
      console.log("ℹ️ Nenhum filtro de cidade aplicado (cityName não fornecido)");
    }

    // Limitar número de resultados
    finalResults = finalResults.slice(0, limitNum);

    return res.status(200).json({
      results: finalResults,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar endereços:", error);
    
    if (error.response) {
      return res.status(error.response.status || 500).json({
        message: "Erro ao buscar endereços.",
        error: error.response.data?.message || error.message,
      });
    }

    return res.status(500).json({
      message: "Erro interno ao buscar endereços.",
    });
  }
};








