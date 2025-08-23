# CodingAgent Configuration Examples

This document provides configuration examples for different types of OpenAI-compatible backends.

## Local Models (No Authentication)

### Ollama
```json
{
  "codingagent.openai.host": "localhost",
  "codingagent.openai.port": 11434,
  "codingagent.openai.apiKey": "",
  "codingagent.currentModel": "llama3:8b"
}
```

### llama.cpp
```json
{
  "codingagent.openai.host": "localhost",
  "codingagent.openai.port": 8080,
  "codingagent.openai.apiKey": "",
  "codingagent.currentModel": "llama-3-8b-instruct"
}
```

### LocalAI
```json
{
  "codingagent.openai.host": "localhost",
  "codingagent.openai.port": 8080,
  "codingagent.openai.apiKey": "",
  "codingagent.currentModel": "gpt-3.5-turbo"
}
```

## Remote/Cloud Services (With API Key)

### OpenAI API
```json
{
  "codingagent.openai.host": "api.openai.com",
  "codingagent.openai.port": 443,
  "codingagent.openai.apiKey": "sk-your-api-key-here",
  "codingagent.currentModel": "gpt-4"
}
```

### Custom OpenAI-Compatible Service
```json
{
  "codingagent.openai.host": "your-api-server.com",
  "codingagent.openai.port": 443,
  "codingagent.openai.apiKey": "your-api-key-here",
  "codingagent.currentModel": "custom-model-name"
}
```

### vLLM Server (Local with Authentication)
```json
{
  "codingagent.openai.host": "localhost",
  "codingagent.openai.port": 8000,
  "codingagent.openai.apiKey": "token-your-auth-token",
  "codingagent.currentModel": "meta-llama/Llama-2-7b-chat-hf"
}
```

## Security Considerations

### API Key Storage
- API keys are stored in VS Code's secure settings
- Never commit API keys to version control
- Use environment variables for shared configurations

### Local vs Remote
- **Local models**: Leave API key empty for better security
- **Remote services**: Always use API keys for authentication
- **Development**: Consider using local models to avoid API costs

## Troubleshooting

### Connection Issues
1. **Test Connection**: Use the "Test Connection" button in settings
2. **Check Network**: Ensure the host and port are accessible
3. **Verify API Key**: Make sure the API key is valid and has correct permissions
4. **HTTPS vs HTTP**: Some services require HTTPS (port 443)

### Model Not Found
1. **List Models**: Check available models on your server
2. **Model Name**: Ensure exact model name matching (case-sensitive)
3. **Model Loading**: Some servers need time to load models

### Authentication Errors
1. **API Key Format**: Verify correct API key format
2. **Permissions**: Ensure API key has chat completion permissions
3. **Rate Limits**: Check if you've exceeded API rate limits
