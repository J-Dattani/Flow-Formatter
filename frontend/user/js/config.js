/**
 * Configuration settings for the FormatFlow application
 * This file controls global settings and feature flags
 */
const AppConfig = {
    // General app settings
    appName: "FormatFlow",
    version: "1.0.0",

    // Feature flags
    features: {
        enableAnimations: true,
        enableNotifications: true,
        darkMode: false,
    },
    
    // Data mode settings
    dataMode: {
        // Set to 'static' for demo mode with mock data or 'api' for real backend calls
        mode: 'static',
        
        // API settings (used when mode is 'api')
        api: {
            baseUrl: 'https://api.formatflow.example',
            timeout: 10000, // 10 seconds
            retryAttempts: 3
        },
        
        // Demo data delay to simulate network requests in static mode (in milliseconds)
        demoDelay: 500
    },
    
    // User settings defaults
    defaults: {
        theme: 'light',
        timezone: 'UTC',
        language: 'en-US',
        dateFormat: 'MM/DD/YYYY',
    }
};

// Prevent modifications to the config object
Object.freeze(AppConfig);