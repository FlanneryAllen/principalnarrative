# Production Deployment Guide

## Logging

The application now includes structured logging with the following features:

### Log Locations
- **Console**: INFO level and above
- **File**: `logs/narrative-api.log` - DEBUG level and above with detailed formatting

### Log Format
```
2025-12-14 21:50:16 - principal_narrative.main - INFO - main.py:118 - Starting Principal Narrative API v1.0.0
```

Format: `timestamp - logger_name - level - file:line - message`

### Request Logging
All HTTP requests are automatically logged with:
- Request method and path
- Response status code
- Request duration in seconds
- Errors with full stack traces

### Service Loggers
Each service has its own logger:
- `principal_narrative.main` - Main application
- `principal_narrative.services.narrative` - Narrative service
- `principal_narrative.services.llm` - LLM service
- `principal_narrative.services.coherence` - Coherence service
- `principal_narrative.services.drift_detector` - Drift detection
- `principal_narrative.services.vector_store` - Vector store
- `principal_narrative.services.ingestion` - Ingestion service

### Configuration
Logging level can be adjusted in `src/logging_config.py`:
```python
setup_logging(log_level="INFO", log_file="logs/narrative-api.log")
```

Available levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

## Error Handling

All service methods include error handling with:
- Automatic error logging with stack traces
- Graceful degradation (returns empty results instead of crashing)
- Detailed error context in logs

## Monitoring

### Health Check
```bash
curl http://localhost:8000/health
```

Returns:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "narrative_path": "/path/to/applied-narrative",
  "narrative_exists": true
}
```

### Log Monitoring
Monitor the log file for errors:
```bash
tail -f logs/narrative-api.log | grep ERROR
```

### Performance Monitoring
Request durations are logged for all endpoints. Monitor slow requests:
```bash
tail -f logs/narrative-api.log | grep "Duration:"
```

## Next Steps for Production

1. **Rate Limiting**: Add rate limiting middleware
2. **Metrics**: Add Prometheus metrics for observability
3. **Alerting**: Set up alerts for ERROR level logs
4. **Log Rotation**: Configure logrotate or similar for log file management
5. **Distributed Tracing**: Add OpenTelemetry for request tracing
6. **Security Headers**: Add security headers middleware
7. **Database Pooling**: If adding persistent storage
8. **Caching**: Add Redis for frequently accessed data
