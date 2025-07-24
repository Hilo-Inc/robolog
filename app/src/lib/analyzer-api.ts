// This function reads the internal URL for the analyzer service from an environment variable.
// It provides a sensible default for the Docker environment if the variable isn't set.
export function getAnalyzerUrl(): string {
    const baseUrl = process.env.ANALYZER_INTERNAL_URL || 'http://analyzer:9880';
    // Remove any trailing slashes to prevent double slashes in constructed URLs.
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}
