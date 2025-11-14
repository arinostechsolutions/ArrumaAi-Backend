const axios = require("axios");

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "sk.eyJ1IjoiaHVsemVyNCIsImEiOiJjbWhxZHBlZ20wbjR6MmxxY3lweGt3ZXRqIn0.psXEo77gaQPa1eyRzS3NnA";

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




