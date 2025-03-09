"""
Logging configuration with custom formatter and status markers for visual feedback.
"""

import logging

# Configure custom logging
class EmojiFormatter(logging.Formatter):
    """Custom formatter that creates clean, readable logs with emojis"""
    
    def format(self, record):
        # Get timestamp
        timestamp = self.formatTime(record, self.datefmt)
        
        # Determine log level emoji
        level_emoji = {
            'DEBUG': '🔍',
            'INFO': '📝',
            'WARNING': '⚠️',
            'ERROR': '❌',
            'CRITICAL': '🚨'
        }.get(record.levelname, '●')
        
        # Format message with status marker if present
        msg = record.getMessage()
        if hasattr(record, 'status_marker'):
            msg = f"{record.status_marker} {msg}"
            
        # Create the final formatted log
        return f"{timestamp} {level_emoji} {msg}"

# Status markers for image generation stages - simplified
class StatusMarker:
    INIT = "🔵"
    PROCESSING = "🟡"
    SUCCESS = "✅"
    ERROR = "❌"
    UPLOAD = "📤"
    DOWNLOAD = "📥"
    MODEL = "🧠"
    PROMPT = "💬"
    LORA = "🎨"

# Create logger
logger = logging.getLogger("acet")
logger.setLevel(logging.INFO)
# Prevent logs from propagating to root logger to avoid duplicates
logger.propagate = False

# Remove all existing handlers
for handler in logger.handlers[:]:
    logger.removeHandler(handler)

# Create console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Create formatter with simplified format
date_format = "%H:%M:%S"
formatter = EmojiFormatter(None, date_format)
console_handler.setFormatter(formatter)

# Add handler to logger
logger.addHandler(console_handler) 