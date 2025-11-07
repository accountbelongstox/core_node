"""
Smart Recognition Module

Provides intelligent parsing of user input to extract API URLs and tokens.
Supports automatic filling of multiple variables based on extracted data.
"""

import re
from typing import Dict, List, Optional, Tuple


class SmartRecognitionResult:
    """Result of smart recognition extraction"""

    def __init__(self):
        self.api_urls: List[str] = []
        self.tokens: List[str] = []
        self.access_key_ids: List[str] = []
        self.cleaned_text: str = ""
        self.total_segments: int = 0

    def has_urls(self) -> bool:
        """Check if any URLs were found"""
        return len(self.api_urls) > 0

    def has_tokens(self) -> bool:
        """Check if any tokens were found"""
        return len(self.tokens) > 0

    def has_data(self) -> bool:
        """Check if any data was extracted"""
        return self.has_urls() or self.has_tokens()


def has_whitespace_in_middle(text: str) -> bool:
    """
    Check if text has whitespace in the middle (not just at ends)

    Args:
        text: Input text to check

    Returns:
        True if text contains internal whitespace
    """
    stripped = text.strip()
    return ' ' in stripped or '\t' in stripped or '\n' in stripped or '\r' in stripped


def extract_api_url_and_token(input_text: str) -> SmartRecognitionResult:
    """
    Extract API URLs and tokens from user input

    Parsing rules:
    - API URLs: Strings starting with http:// or https://
    - Access Key IDs: 16+ uppercase alphanumeric characters
    - Tokens: Strings longer than 37 characters

    Args:
        input_text: User input text (may contain multiple lines and spaces)

    Returns:
        SmartRecognitionResult containing extracted data
    """
    result = SmartRecognitionResult()

    # Clean up text: normalize whitespace
    cleaned_text = input_text.replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    result.cleaned_text = cleaned_text

    # Split into tokens
    segments = [seg.strip() for seg in cleaned_text.split() if seg.strip()]
    result.total_segments = len(segments)

    # Extract different types of data
    for segment in segments:
        # Check for API URLs
        if re.match(r'^https?://', segment, re.IGNORECASE):
            result.api_urls.append(segment)
        # Check for Access Key IDs (16+ uppercase alphanumeric)
        elif re.match(r'^[A-Z0-9]{16,}$', segment):
            result.access_key_ids.append(segment)
        # Check for tokens (length > 37)
        elif len(segment) > 37:
            result.tokens.append(segment)

    return result


def get_token_variables(config: Dict) -> List[Dict]:
    """
    Get all Token-type variables from configuration

    Args:
        config: Configuration dictionary

    Returns:
        List of variables with InputType = "Token"
    """
    token_vars = []

    if 'Variables' in config:
        for var in config['Variables']:
            if var.get('InputType') == 'Token':
                token_vars.append(var)

    return token_vars


def display_extraction_results(result: SmartRecognitionResult):
    """
    Display extraction results to user

    Args:
        result: SmartRecognitionResult to display
    """
    from common_utils import ColorMessage

    ColorMessage.write("Extraction Results:", 'info')
    ColorMessage.write(f"Total segments: {result.total_segments}", 'info')

    if result.api_urls:
        ColorMessage.write("Found API URLs:", 'info')
        for url in result.api_urls:
            ColorMessage.write(f"  - {url}", 'info')

    if result.tokens:
        ColorMessage.write(f"Found Tokens (length > 37):", 'info')
        for token in result.tokens:
            ColorMessage.write(f"  - {token}", 'info')

    if result.access_key_ids:
        ColorMessage.write(f"Found Access Key IDs (16+ chars):", 'info')
        for key_id in result.access_key_ids:
            ColorMessage.write(f"  - {key_id}", 'info')

    print()


def prompt_token_fill_strategy(token_variables: List[Dict]) -> Tuple[str, Optional[Dict]]:
    """
    Prompt user to select token fill strategy

    Args:
        token_variables: List of Token-type variables

    Returns:
        Tuple of (strategy, target_variable)
        - strategy: "all" or "single"
        - target_variable: The selected variable (only if strategy is "single")
    """
    from common_utils import ColorMessage

    if len(token_variables) <= 1:
        return "all", None

    print()
    ColorMessage.write("Token filling strategy:", 'info')
    ColorMessage.write("  [Enter/Y] Fill all Token-type variables (default)", 'info')

    for idx, token_var in enumerate(token_variables):
        ColorMessage.write(f"  [{idx + 1}] Fill only: {token_var['DisplayName']}", 'info')

    print()
    choice = input("Select strategy (default: all): ").strip()

    if not choice or choice.lower() == 'y':
        ColorMessage.write("Strategy: Fill all Token variables", 'success')
        return "all", None

    try:
        selected_idx = int(choice) - 1
        if 0 <= selected_idx < len(token_variables):
            target_var = token_variables[selected_idx]
            ColorMessage.write(f"Strategy: Fill only {target_var['DisplayName']}", 'success')
            return "single", target_var
        else:
            ColorMessage.write("Invalid selection, using default: Fill all", 'warning')
            return "all", None
    except ValueError:
        ColorMessage.write("Invalid input, using default: Fill all", 'warning')
        return "all", None


def get_value_for_input_type(input_type: str, extracted_data: SmartRecognitionResult,
                            original_input: str) -> str:
    """
    Get the appropriate value based on InputType

    Args:
        input_type: Type of input (e.g., "Url", "Token")
        extracted_data: Extracted data from smart recognition
        original_input: Original user input

    Returns:
        The selected value
    """
    from common_utils import ColorMessage

    if input_type == "Url" and extracted_data.api_urls:
        value = extracted_data.api_urls[0]
        ColorMessage.write(f"Using first API URL: {value}", 'success')
        return value
    elif input_type == "Token" and extracted_data.tokens:
        value = extracted_data.tokens[0]
        ColorMessage.write(f"Using first Token: {value}", 'success')
        return value
    else:
        ColorMessage.write("Using original input (no matching type found)", 'warning')
        return original_input
