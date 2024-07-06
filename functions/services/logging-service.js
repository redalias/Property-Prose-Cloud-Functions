class LoggingService {
    /**
     * Creates a new LoggingService instance with the provided class name.
     * 
     * @param {string} className The name of the class where the logger is being used.
     */
    constructor(className = '') {
        this.className = className;
    }

    /**
     * Formats a given object into a string representation suitable for logging.
     * 
     * This method attempts to convert the provided object to a pretty-printed JSON string.
     * It handles circular references by returning a placeholder and avoids excessive nesting
     * by limiting the depth of JSON stringification.
     * 
     * @param {object} obj The object to be formatted.
     * @param {number} depth (Optional) The current depth level during recursive calls.
     *  Defaults to 0.
     * @returns {string} The formatted string representation of the object.
     */
    formatObject(obj, depth = 0) {
        if (typeof obj === 'object' && obj !== null) {
            if (depth > 2) { // Limit nesting depth to avoid excessive logs (adjust as needed)
                return '[Object]';
            }

            // Try-catch with more specific error handling
            try {
                // Use replacer function to handle circular references
                return JSON.stringify(obj, (key, value) => {
                    if (typeof value === 'object' && value !== null && depth >= 2) {
                        // If depth limit reached or circular reference detected, return a placeholder
                        return '[Circular]';
                    }
                    // Otherwise, return the value as usual
                    return value;
                }, 2);
            } catch (error) {
                // Log the error message instead of just '[Circular]'
                console.error('Error formatting object:', error.message);
                return '[Error]';
            }
        } else {
            return obj;
        }
    }


    /**
     * Logs a message with the specified level.
     * 
     * This method logs a message to the console with the provided level (INFO, WARN, ERROR).
     * It prefixes the log line with the class name, level, and timestamp (optional).
     * It also includes the context object as formatted JSON (handling circular references).
     * 
     * @param {string} level The log level (INFO, WARN, ERROR).
     * @param {string} message The message to be logged.
     * @param {object} context (Optional) An object containing additional context data for the log.
     */
    log(level, message, context = {}) {
        let logLine;

        if (this.className.length === 0) {
            // The log was called from index.js, which does not have a class name.
            logLine = `[${level}] ${message}`;
        } else {
            // The log was called from index.js, which does not have a class name.
            logLine = `[${level}] [${this.className}] ${message}`;
        }


        // Check if context is an object before formatting
        const depth = 4;
        const formattedContext = Object.keys(context).length > 0 ? this.formatObject(context, depth) : '';

        switch (level.toUpperCase()) {
            case 'INFO':
                console.log(logLine, formattedContext);
                break;

            case 'WARN':
                console.warn(logLine, formattedContext);
                break;

            case 'ERROR':
                console.error(logLine, formattedContext);
                break;

            default:
                console.log(`Invalid log level: ${level}`);
                break;
        }
    }


    /**
     * Logs an informational message.
     * 
     * This is a shortcut method for logging with the INFO level.
     * 
     * @param {string} message The message to be logged.
     * @param {object} context (Optional) An object containing additional context data for the log.
     */
    info(message, context = {}) {
        this.log('INFO', message, context);
    }

    /**
     * Logs a warning message.
     * 
     * This is a shortcut method for logging with the WARN level.
     * 
     * @param {string} message The message to be logged.
     * @param {object}
      /**
       * Logs a warning message.
       *
       * This is a shortcut method for logging with the WARN level.
       *
       * @param {string} message The message to be logged.
       * @param {object} context (Optional) An object containing additional context data for the log.
       */
    warn(message, context = {}) {
        this.log('WARN', message, context);
    }

    /**
     * Logs an error message.
     * 
     * This is a shortcut method for logging with the ERROR level.
     * 
     * @param {string} message The message to be logged.
     * @param {object} context (Optional) An object containing additional context data for the log.
     */
    error(message, context = {}) {
        this.log('ERROR', message, context);
    }
}

module.exports = LoggingService;
