$body = @{
    nodes = @(
        @{
            parameters = @{
                httpMethod = "POST"
                path = "scan-receipt"
                responseMode = "responseNode"
                options = @{}
            }
            id = "webhook-scan"
            name = "Webhook"
            type = "n8n-nodes-base.webhook"
            typeVersion = 1
            position = @(250, 300)
            webhookId = "3fcf1f97-2f60-4595-b826-22166eb0ec71"
        }
        @{
            parameters = @{
                method = "POST"
                url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
                authentication = "none"
                sendQuery = $true
                queryParameters = @{
                    parameters = @(
                        @{
                            name = "key"
                            value = "={{ `$json.body.apiKey }}"
                        }
                    )
                }
                sendBody = $true
                specifyBody = "json"
                jsonBody = "={\n  \"contents\": [{\n    \"parts\": [\n      { \"text\": {{ `$json.body.prompt | toJSON }} },\n      {\n        \"inline_data\": {\n          \"mime_type\": {{ `$json.body.mimeType | toJSON }},\n          \"data\": {{ `$json.body.base64Image | toJSON }}\n        }\n      }\n    ]\n  }]\n}"
                options = @{}
            }
            id = "gemini-call"
            name = "Gemini API"
            type = "n8n-nodes-base.httpRequest"
            typeVersion = 4.2
            position = @(450, 300)
        }
        @{
            parameters = @{
                jsCode = "// Extraire le texte JSON de la r\u00e9ponse Gemini\nconst text = `$input.first().json.candidates[0].content.parts[0].text;\nconst jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();\nconst data = JSON.parse(jsonStr);\n\nreturn [{\n  json: {\n    supplier: data.supplier || '',\n    matriculeFiscal: data.matriculeFiscal || '',\n    date: data.date || new Date().toISOString().split('T')[0],\n    subtotal: parseFloat(data.subtotal) || 0,\n    fodec: parseFloat(data.fodec) || 0,\n    vatRate: parseFloat(data.vatRate) || 19,\n    vatAmount: parseFloat(data.vatAmount) || 0,\n    stampDuty: data.stampDuty !== undefined ? parseFloat(data.stampDuty) : 1.000,\n    totalAmount: parseFloat(data.totalAmount) || 0,\n    category: data.category || 'Autres',\n    invoiceNumber: data.invoiceNumber || ''\n  }\n}];"
            }
            id = "parse-response"
            name = "Parser la r\u00e9ponse"
            type = "n8n-nodes-base.code"
            typeVersion = 2
            position = @(650, 300)
        }
        @{
            parameters = @{
                respondWith = "json"
                responseBody = "={{ `$json }}"
            }
            id = "respond"
            name = "R\u00e9pondre"
            type = "n8n-nodes-base.respondToWebhook"
            typeVersion = 1
            position = @(850, 300)
        }
    )
    connections = @{
        Webhook = @{
            main = @(@(@{ node = "Gemini API"; type = "main"; index = 0 }))
        }
        "Gemini API" = @{
            main = @(@(@{ node = "Parser la r\u00e9ponse"; type = "main"; index = 0 }))
        }
        "Parser la r\u00e9ponse" = @{
            main = @(@(@{ node = "R\u00e9pondre"; type = "main"; index = 0 }))
        }
    }
    settings = @{
        executionOrder = "v1"
    }
}

return $body | ConvertTo-Json -Depth 10
