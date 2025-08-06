# Ollama Configuration Page

A comprehensive configuration interface for optimizing Ollama AI model performance in Robolog.

## Features

### 🚀 Performance Optimization
- **Model Keep-Alive**: Configure how long models stay loaded in memory (5min - indefinite)
- **Streaming**: Enable real-time response streaming for faster perceived performance
- **Model Warm-up**: Pre-load models to eliminate startup delays
- **Model Testing**: Test model connectivity and response times

### 🎛️ Model Configuration
- **Model Selection**: Choose from available Ollama models
- **Temperature Control**: Adjust response creativity (0.0-2.0)
- **Token Limits**: Set maximum response length (50-2048 tokens)
- **Advanced Parameters**: Fine-tune Top-P, Top-K, and repeat penalty

### ⚙️ Advanced Settings
- **Top-P (Nucleus Sampling)**: Control response diversity (0.1-1.0)
- **Top-K**: Limit vocabulary to top K tokens (1-100)
- **Repeat Penalty**: Reduce repetitive responses (0.5-2.0)
- **Stop Tokens**: Define custom stopping sequences

### 📊 System Monitoring
- **Real-time Status**: Connection status and system health
- **Memory Usage**: Monitor available system memory
- **Queue Status**: View analysis queue size and processing stats
- **Uptime**: Track system uptime and request counts

## Navigation

Access the configuration page through the sidebar:
- **Dashboard** → Overview and reports
- **Testing Tools** → Generate test logs
- **Ollama Config** → Model configuration (NEW)

## Configuration Options

### Keep-Alive Settings
| Setting | Description | Use Case |
|---------|-------------|----------|
| 5 minutes | Light usage | Development/testing |
| 10 minutes | Balanced | **Recommended default** |
| 30 minutes | Heavy usage | Production with frequent logs |
| 1 hour | Continuous | High-traffic environments |
| Indefinite | Always loaded | Maximum performance |
| Immediate | Unload after use | Memory-constrained systems |

### Recommended Settings

#### **Production (High Performance)**
```
Keep-Alive: 30 minutes
Temperature: 0.2
Top-P: 0.8
Top-K: 20
Streaming: Enabled
Max Tokens: 500
```

#### **Development (Balanced)**
```
Keep-Alive: 10 minutes
Temperature: 0.3
Top-P: 0.9
Top-K: 30
Streaming: Enabled
Max Tokens: 300
```

#### **Resource-Constrained**
```
Keep-Alive: 5 minutes
Temperature: 0.1
Top-P: 0.7
Top-K: 15
Streaming: Disabled
Max Tokens: 200
```

## Performance Impact

### Keep-Alive Benefits
- **First Request**: 2-30 seconds (cold start)
- **Subsequent Requests**: 0.5-2 seconds (warm model)
- **Memory Usage**: +2-8GB depending on model size

### Streaming Benefits
- **Perceived Speed**: 40-60% faster
- **Real-time Feedback**: Users see progress immediately
- **Better UX**: No waiting for complete response

### Optimal Parameters for Log Analysis
- **Low Temperature** (0.1-0.3): More focused, consistent analysis
- **Moderate Top-P** (0.7-0.8): Balance between creativity and reliability
- **Limited Top-K** (15-25): Prevent irrelevant vocabulary
- **Short Responses** (300-500 tokens): Concise, actionable insights

## API Endpoints

The configuration page uses these new analyzer endpoints:

### Configuration Management
- `GET /analyzer/status` - Current configuration and system status
- `POST /analyzer/config` - Update configuration parameters
- `GET /analyzer/ollama/models` - List available Ollama models

### Testing & Diagnostics
- `POST /analyzer/test-model` - Test model connectivity and performance
- `POST /analyzer/warm-model` - Pre-load model with keep-alive settings

## Usage Tips

1. **Start with defaults** and adjust based on performance needs
2. **Monitor memory usage** when increasing keep-alive duration
3. **Test changes** using the built-in model testing features
4. **Use streaming** for better user experience in production
5. **Lower temperature** for more consistent log analysis
6. **Warm up models** during system startup or maintenance windows

## Troubleshooting

### Model Not Loading
- Check Ollama service status
- Verify model is installed (`ollama list`)
- Test connectivity with "Test Model" button

### Slow Performance
- Increase keep-alive duration
- Enable streaming
- Reduce max tokens limit
- Lower temperature and Top-K values

### High Memory Usage
- Reduce keep-alive duration
- Use smaller models
- Set keep-alive to "Immediate" for low-memory systems

### Configuration Not Saving
- Check analyzer service connectivity
- Verify valid parameter ranges
- Review browser console for errors

## Security Notes

- Configuration changes are applied immediately
- Original settings are restored on service restart
- No sensitive data is stored in browser localStorage
- All configuration is handled server-side