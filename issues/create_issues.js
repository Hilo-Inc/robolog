#!/usr/bin/env node
//programmmatically create issues in a github repo for robolog

const https = require('https');

// GitHub API configuration
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'Hilo-Inc';
const REPO_NAME = 'robolog';

// Issues data
const issues = [
  // Bug Fixes
  {
    title: 'Fix edge cases in log deduplication that incorrectly merge distinct errors',
    body: `## Problem
Address edge cases in log deduplication that may incorrectly merge distinct errors.

## Description
The current log deduplication logic may be too aggressive and merge errors that should be treated as distinct. This can lead to important error information being lost or misrepresented.

## Expected Behavior
- Each distinct error should be properly identified and categorized
- Similar but different errors should not be merged inappropriately
- Error context and details should be preserved during deduplication

## Areas to Investigate
- Review current deduplication algorithm
- Test with various error patterns
- Ensure error signatures are sufficiently unique
- Validate that contextual information is properly considered

## Priority
High - This affects the accuracy of error reporting and analysis`,
    labels: ['bug', 'priority:high', 'component:analyzer']
  },
  {
    title: 'Improve error handling and retry logic for Ollama inference failures',
    body: `## Problem
Improve error handling and retry logic for Ollama inference failures.

## Description
The current system may not gracefully handle failures when communicating with the Ollama AI service. This can result in lost log analysis or system instability.

## Expected Behavior
- Implement robust retry mechanisms for transient failures
- Proper error classification (retryable vs non-retryable)
- Graceful degradation when AI service is unavailable
- Clear logging of AI service issues

## Implementation Ideas
- Exponential backoff for retries
- Circuit breaker pattern for repeated failures
- Fallback mechanisms when AI analysis is unavailable
- Health checks for Ollama service

## Priority
Medium - Important for system reliability`,
    labels: ['bug', 'priority:medium', 'component:ai', 'enhancement']
  },
  {
    title: 'Resolve potential race conditions in queue management',
    body: `## Problem
Resolve potential race conditions in queue management.

## Description
The current queue management system may have race conditions that could lead to:
- Lost log entries
- Duplicate processing
- Queue corruption
- System instability

## Expected Behavior
- Thread-safe queue operations
- Atomic operations for critical sections
- Proper synchronization mechanisms
- No data loss under concurrent access

## Areas to Review
- Log ingestion queue
- Processing pipeline
- Webhook delivery queue
- State management

## Priority
High - Race conditions can cause data loss and system instability`,
    labels: ['bug', 'priority:high', 'component:core', 'concurrency']
  },

  // UX Improvements
  {
    title: 'Enhance dashboard with richer visualizations of log trends and issue frequencies',
    body: `## Feature Request
Enhance the dashboard with richer visualizations of log trends and issue frequencies.

## Description
The current dashboard could benefit from more comprehensive visualizations to help users understand:
- Log volume trends over time
- Error frequency patterns
- Issue severity distributions
- Performance metrics

## Proposed Features
- **Time Series Charts**: Show log volume and error rates over time
- **Heatmaps**: Display error frequency by time of day/day of week
- **Severity Distribution**: Pie charts or bar graphs showing error severity breakdown
- **Top Issues**: List of most frequent errors with trending indicators
- **Performance Metrics**: Response times, processing latency, etc.
- **Interactive Filters**: Allow filtering by time range, severity, component

## Technical Considerations
- Consider using Chart.js, D3.js, or similar visualization library
- Ensure responsive design for mobile devices
- Implement efficient data aggregation for large datasets
- Add export functionality for charts and data

## Priority
Medium - Would significantly improve user experience`,
    labels: ['enhancement', 'priority:medium', 'component:dashboard', 'ui/ux']
  },
  {
    title: 'Simplify webhook integration with guided onboarding for popular platforms',
    body: `## Feature Request
Simplify webhook integration with guided onboarding for popular platforms.

## Description
Current webhook setup can be complex for new users. We should provide guided setup flows for popular platforms to improve the onboarding experience.

## Proposed Features
- **Platform-specific Setup Wizards**: Step-by-step guides for Discord, Slack, Teams, etc.
- **Auto-detection**: Detect webhook URL format and suggest platform
- **Test Integration**: Built-in webhook testing to verify setup
- **Template Messages**: Pre-configured message formats for each platform
- **Visual Setup Guide**: Screenshots and visual aids for webhook creation
- **Validation**: Real-time validation of webhook URLs and formats

## Supported Platforms to Prioritize
1. Discord
2. Slack
3. Microsoft Teams
4. Telegram
5. Mattermost

## Implementation Ideas
- Interactive setup wizard in web UI
- Platform-specific validation rules
- Test message functionality
- Setup verification workflow
- Documentation with screenshots

## Priority
Medium - Important for user adoption and ease of setup`,
    labels: ['enhancement', 'priority:medium', 'component:webhooks', 'onboarding', 'ui/ux']
  },

  // Reusability Improvements
  {
    title: 'Modularize and document Node.js Analyzer codebase for easier customization',
    body: `## Feature Request
Modularize and document the Node.js Analyzer codebase for easier customization and integration.

## Description
The current analyzer codebase could be better structured to allow for easier customization, extension, and integration into other systems.

## Proposed Improvements

### Code Structure
- **Modular Architecture**: Break down monolithic components into focused modules
- **Plugin System**: Allow custom log parsers and processors
- **Configuration-driven**: Make behavior configurable without code changes
- **Clear Interfaces**: Define clear APIs between components

### Documentation
- **API Documentation**: Comprehensive JSDoc comments
- **Architecture Guide**: High-level system design documentation
- **Customization Guide**: How to extend and modify the analyzer
- **Integration Examples**: Sample code for common integration patterns

### Extensibility
- **Custom Parsers**: Interface for adding new log format parsers
- **Custom Processors**: Allow custom log processing logic
- **Custom Outputs**: Support for additional output formats and destinations
- **Event Hooks**: Callbacks for key processing events

## Technical Implementation
- Implement dependency injection pattern
- Create abstract base classes for key components
- Use configuration files for behavior customization
- Add comprehensive unit tests for all modules

## Priority
High - Essential for project maintainability and adoption`,
    labels: ['enhancement', 'priority:high', 'component:analyzer', 'architecture', 'documentation']
  },
  {
    title: 'Abstract Fluent Bit configuration for better Linux distribution support',
    body: `## Feature Request
Abstract Fluent Bit configuration to better support diverse Linux distributions and logging environments.

## Description
Current Fluent Bit configuration may not work optimally across all Linux distributions and logging setups. We need a more flexible approach that adapts to different environments.

## Proposed Features

### Distribution-Specific Configs
- **Auto-detection**: Automatically detect the Linux distribution
- **Template System**: Distribution-specific configuration templates
- **Path Detection**: Automatically discover log file locations
- **Service Integration**: Proper integration with systemd, syslog-ng, rsyslog, etc.

### Flexible Log Sources
- **Multiple Input Sources**: Support for various log sources simultaneously
- **Custom Log Paths**: Easy configuration for non-standard log locations
- **Container Logs**: Better support for Docker and container environments
- **Remote Logs**: Support for remote syslog and other log forwarding

### Configuration Management
- **Configuration Wizard**: Interactive setup for Fluent Bit configuration
- **Validation**: Validate configuration before deployment
- **Hot Reload**: Support for configuration changes without restart
- **Backup/Restore**: Configuration backup and restore functionality

## Supported Distributions Priority
1. Ubuntu/Debian
2. CentOS/RHEL/Rocky Linux
3. Fedora
4. Arch Linux
5. SUSE/openSUSE

## Implementation Ideas
- Configuration template engine
- Distribution detection script
- Log path discovery utility
- Configuration validation tool

## Priority
Medium - Important for broader platform support`,
    labels: ['enhancement', 'priority:medium', 'component:fluent-bit', 'platform-support']
  },
  {
    title: 'Abstract Ollama and AI model into a Lambda function',
    body: `## Feature Request
Abstract Ollama and AI model into a Lambda function.

## Description
Create a serverless Lambda function that encapsulates the AI model inference, making the system more scalable and allowing for easier deployment and management.

## Benefits
- **Scalability**: Automatic scaling based on demand
- **Cost Efficiency**: Pay only for actual inference time
- **Simplified Deployment**: Easier to deploy and manage AI components
- **Resource Optimization**: Better resource utilization
- **Isolation**: Separate AI processing from core log processing

## Proposed Architecture
- **Lambda Function**: Contains Ollama model and inference logic
- **API Gateway**: RESTful API for inference requests
- **Event-driven**: Support for both synchronous and asynchronous processing
- **Queue Integration**: Use SQS for batch processing
- **Model Management**: Support for multiple models and versions

## Implementation Plan
1. **Phase 1**: Create basic Lambda function with single model
2. **Phase 2**: Add support for multiple models
3. **Phase 3**: Implement batch processing
4. **Phase 4**: Add monitoring and logging

## Technical Considerations
- Container-based Lambda for larger models
- Cold start optimization
- Model caching strategies
- Error handling and retries
- Cost optimization

## Priority
Medium - Good for scalability and cloud-native architecture`,
    labels: ['enhancement', 'priority:medium', 'component:ai', 'serverless', 'architecture']
  },
  {
    title: 'Provide hosted AI API option as alternative to self-hosting',
    body: `## Feature Request
Give users the option to use a hosted AI API call instead of self-hosting.

## Description
Provide users with the choice between self-hosting Ollama/local AI models or using a hosted AI service (OpenAI, Anthropic, etc.) for easier setup and management.

## Proposed Features

### Hosted AI Integration
- **OpenAI Integration**: Support for GPT models via OpenAI API
- **Anthropic Integration**: Support for Claude models
- **Multiple Providers**: Allow users to choose from different AI providers
- **Fallback Options**: Primary and backup AI service configuration

### Configuration Options
- **API Key Management**: Secure storage and management of API keys
- **Model Selection**: Choose between different models from each provider
- **Cost Controls**: Usage limits and cost monitoring
- **Hybrid Mode**: Option to use both hosted and self-hosted models

### Benefits for Users
- **Easy Setup**: No need to install and manage local AI models
- **Always Updated**: Access to latest models without manual updates
- **Scalability**: No local resource constraints
- **Reliability**: Professional SLA and uptime guarantees

## Implementation Strategy
- **Configuration UI**: Easy switching between hosted and self-hosted
- **API Abstraction**: Common interface for all AI providers
- **Cost Monitoring**: Track and display usage costs
- **Security**: Encrypted API key storage

## Supported Providers (Priority Order)
1. OpenAI (GPT-3.5, GPT-4)
2. Anthropic (Claude)
3. Google (Gemini)
4. Self-hosted (Ollama)

## Priority
High - Major user experience improvement for ease of setup`,
    labels: ['enhancement', 'priority:high', 'component:ai', 'cloud-integration', 'user-experience']
  },

  // Fine-Tuning Possibilities
  {
    title: 'Fine-tune Gemma 3n on domain-specific log data for improved diagnostic accuracy',
    body: `## Research/Enhancement Request
Fine-tune Gemma 3n on domain-specific log data to improve diagnostic accuracy.

## Description
Explore fine-tuning the Gemma 3n model on log analysis specific datasets to improve the accuracy and relevance of diagnostic suggestions.

## Objectives
- **Improved Accuracy**: Better error classification and root cause analysis
- **Domain Knowledge**: Incorporate log analysis best practices into the model
- **Contextual Understanding**: Better understanding of technical terminology and patterns
- **Reduced False Positives**: More accurate error detection and classification

## Research Areas

### Dataset Development
- **Log Corpus**: Collect diverse, representative log samples
- **Error Classification**: Create labeled dataset of error types and severities
- **Solution Mapping**: Map common errors to known solutions
- **Domain Terminology**: Build vocabulary of technical terms and concepts

### Fine-tuning Approach
- **Task-specific Training**: Focus on log analysis tasks
- **Transfer Learning**: Build on existing Gemma 3n capabilities
- **Evaluation Metrics**: Define success criteria for log analysis
- **Validation**: Test on real-world log scenarios

### Implementation Considerations
- **Data Privacy**: Ensure training data doesn't contain sensitive information
- **Model Size**: Balance accuracy improvements with resource requirements
- **Update Strategy**: Plan for model updates and retraining
- **Deployment**: Seamless integration with existing system

## Expected Outcomes
- Reduced false positive rate in error detection
- More accurate severity classification
- Better root cause analysis suggestions
- Improved understanding of technical context

## Priority
Low - Research project for future improvements`,
    labels: ['research', 'priority:low', 'component:ai', 'machine-learning', 'fine-tuning']
  },
  {
    title: 'Experiment with model pruning and quantization for optimization',
    body: `## Research/Enhancement Request
Experiment with model pruning and quantization for further optimization.

## Description
Investigate model optimization techniques to reduce resource requirements while maintaining accuracy for log analysis tasks.

## Optimization Techniques

### Model Pruning
- **Structured Pruning**: Remove entire neurons or layers
- **Unstructured Pruning**: Remove individual weights
- **Magnitude-based Pruning**: Remove weights below threshold
- **Gradient-based Pruning**: Remove weights with low gradients

### Quantization
- **Post-training Quantization**: Convert trained model to lower precision
- **Quantization-aware Training**: Train with quantization in mind
- **Dynamic Quantization**: Runtime quantization decisions
- **Mixed Precision**: Use different precisions for different parts

### Knowledge Distillation
- **Teacher-Student**: Train smaller model to mimic larger one
- **Self-distillation**: Model learns from its own predictions
- **Progressive Distillation**: Gradually reduce model size

## Research Objectives
- **Resource Efficiency**: Reduce memory and compute requirements
- **Faster Inference**: Improve response times for log analysis
- **Energy Efficiency**: Lower power consumption for edge deployments
- **Maintain Accuracy**: Minimal impact on diagnostic quality

## Evaluation Metrics
- Model size reduction percentage
- Inference speed improvement
- Memory usage reduction
- Accuracy degradation measurement
- Energy consumption analysis

## Implementation Plan
1. **Baseline Measurement**: Current model performance metrics
2. **Pruning Experiments**: Test different pruning strategies
3. **Quantization Testing**: Evaluate quantization approaches
4. **Combined Approaches**: Test pruning + quantization
5. **Production Testing**: Real-world performance validation

## Priority
Low - Performance optimization research project`,
    labels: ['research', 'priority:low', 'component:ai', 'performance', 'optimization']
  },
  {
    title: 'Develop specialized submodels for specific infrastructure environments',
    body: `## Research/Enhancement Request
Develop specialized submodels for specific infrastructure environments.

## Description
Create specialized AI models optimized for different infrastructure environments (web servers, databases, containers, etc.) to provide more targeted and accurate analysis.

## Proposed Specialized Models

### Web Server Model
- **Focus**: Nginx, Apache, IIS log analysis
- **Specialization**: HTTP errors, performance issues, security threats
- **Training Data**: Web server logs, HTTP status codes, response times

### Database Model
- **Focus**: MySQL, PostgreSQL, MongoDB log analysis
- **Specialization**: Query performance, connection issues, data integrity
- **Training Data**: Database logs, slow query logs, error logs

### Container/Kubernetes Model
- **Focus**: Docker, Kubernetes, container orchestration
- **Specialization**: Resource limits, networking, pod lifecycle
- **Training Data**: Container logs, Kubernetes events, resource metrics

### System/OS Model
- **Focus**: Linux/Windows system logs
- **Specialization**: Hardware issues, system errors, security events
- **Training Data**: System logs, kernel messages, service logs

### Application Model
- **Focus**: Application-specific logs
- **Specialization**: Business logic errors, user experience issues
- **Training Data**: Application logs, exception traces, user actions

## Implementation Strategy

### Model Architecture
- **Shared Base**: Common log processing foundation
- **Specialized Heads**: Environment-specific analysis layers
- **Model Routing**: Automatic selection based on log source
- **Ensemble Methods**: Combine predictions from multiple models

### Training Approach
- **Domain-specific Datasets**: Curated training data for each environment
- **Transfer Learning**: Build on general log analysis capabilities
- **Incremental Learning**: Continuous improvement from production data
- **Validation**: Environment-specific test suites

### Deployment Strategy
- **Model Selection**: Automatic or manual model selection
- **Hot Swapping**: Switch models without system restart
- **A/B Testing**: Compare specialized vs general models
- **Performance Monitoring**: Track accuracy per environment

## Benefits
- **Higher Accuracy**: Environment-specific expertise
- **Better Context**: Understanding of domain-specific issues
- **Targeted Solutions**: More relevant recommendations
- **Faster Diagnosis**: Specialized knowledge reduces analysis time

## Priority
Low - Advanced feature for specialized use cases`,
    labels: ['research', 'priority:low', 'component:ai', 'specialization', 'infrastructure']
  }
];

function createIssue(issue, githubToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels: issue.labels || []
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'robolog-issue-creator',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 201) {
          const createdIssue = JSON.parse(responseData);
          console.log(`✅ Created issue #${createdIssue.number}: ${issue.title}`);
          resolve(createdIssue);
        } else {
          console.error(`❌ Failed to create issue: ${issue.title}`);
          console.error(`Status: ${res.statusCode}`);
          console.error(`Response: ${responseData}`);
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Network error creating issue: ${issue.title}`);
      console.error(error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function createAllIssues() {
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.error('Please set your GitHub personal access token:');
    console.error('export GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }

  console.log(`🚀 Creating ${issues.length} issues for ${REPO_OWNER}/${REPO_NAME}...`);
  console.log('');

  const createdIssues = [];
  
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    console.log(`📝 Creating issue ${i + 1}/${issues.length}: ${issue.title}`);
    
    try {
      const createdIssue = await createIssue(issue, githubToken);
      createdIssues.push(createdIssue);
      
      // Add a small delay between requests to be respectful to the API
      if (i < issues.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to create issue: ${issue.title}`);
      console.error(error.message);
    }
  }

  console.log('');
  console.log(`🎉 Successfully created ${createdIssues.length} out of ${issues.length} issues`);
  
  if (createdIssues.length > 0) {
    console.log('');
    console.log('📋 Created Issues:');
    createdIssues.forEach(issue => {
      console.log(`   #${issue.number}: ${issue.title}`);
      console.log(`   🔗 ${issue.html_url}`);
    });
  }
}

// Run the script
createAllIssues().catch(console.error);