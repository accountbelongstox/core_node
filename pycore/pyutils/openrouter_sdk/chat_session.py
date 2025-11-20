#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat Session Manager

Provides high-level chat session management with caching, streaming, and state tracking.

Features:
- Message history caching
- Stream and batch output modes
- State tracking (idle, processing, completed)
- Auto-select free models
- Conversation management

Usage:
    from pycore.pyutils.openrouter_sdk import ChatSession

    # Create session
    session = ChatSession()

    # Send message and get streaming response
    for chunk in session.send_stream("Hello!"):
        print(chunk, end='', flush=True)

    # Send message and get complete response
    response = session.send("What's the weather?")
    print(response)

    # Check status
    print(session.is_completed())
    print(session.get_state())
"""

import time
import threading
from enum import Enum
from typing import List, Dict, Any, Optional, Callable, Iterator

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.openrouter_sdk.openrouter_client import get_openrouter_client


class SessionState(Enum):
    """Chat session state"""
    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class ChatSession:
    """
    Chat Session Manager

    Manages a conversation session with message history, caching, and state tracking.
    Automatically selects free models and provides both streaming and batch outputs.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_history: int = 100,
        auto_cache: bool = True
    ):
        """
        Initialize chat session

        Args:
            model: Model to use (default: auto-select free model)
            system_prompt: System prompt for the conversation
            max_history: Maximum number of messages to keep in history
            auto_cache: Enable automatic message caching
        """
        self.client = get_openrouter_client()

        # Auto-select free model if not specified
        if model is None:
            model = self._auto_select_free_model()

        self.model = model
        self.system_prompt = system_prompt
        self.max_history = max_history
        self.auto_cache = auto_cache

        # Message history
        self.messages: List[Dict[str, str]] = []
        if system_prompt:
            self.messages.append({
                "role": "system",
                "content": system_prompt
            })

        # Response cache
        self._response_cache: List[str] = []
        self._current_response: str = ""

        # State management
        self._state: SessionState = SessionState.IDLE
        self._state_lock = threading.Lock()

        # Statistics
        self._total_messages = 0
        self._total_tokens = 0

        # Stream callbacks
        self._on_chunk_callbacks: List[Callable[[str], None]] = []
        self._on_complete_callbacks: List[Callable[[str], None]] = []

        ColorPrint.blue(f"[ChatSession] Initialized with model: {self.model}")

    def _auto_select_free_model(self) -> str:
        """
        Auto-select a free model (with 'deepseek' and 'free' keywords)

        Returns:
            str: Selected model ID
        """
        models = self.client.get_models()

        # Find models with both 'deepseek' and 'free' keywords
        free_models = []
        for short_name, full_id in models.items():
            if 'deepseek' in short_name.lower() and 'free' in short_name.lower():
                free_models.append((short_name, full_id))
            elif 'deepseek' in full_id.lower() and 'free' in full_id.lower():
                free_models.append((short_name, full_id))

        if free_models:
            selected = free_models[0]
            ColorPrint.green(f"[ChatSession] Auto-selected free model: {selected[0]} -> {selected[1]}")
            return selected[0]

        # Fallback to 'free' shortcut
        ColorPrint.yellow("[ChatSession] No DeepSeek free model found, using 'free'")
        return 'free'

    def _set_state(self, state: SessionState):
        """Set session state (thread-safe)"""
        with self._state_lock:
            self._state = state

    def get_state(self) -> SessionState:
        """
        Get current session state

        Returns:
            SessionState: Current state
        """
        with self._state_lock:
            return self._state

    def is_idle(self) -> bool:
        """Check if session is idle"""
        return self.get_state() == SessionState.IDLE

    def is_processing(self) -> bool:
        """Check if session is processing"""
        return self.get_state() == SessionState.PROCESSING

    def is_completed(self) -> bool:
        """Check if last conversation is completed"""
        return self.get_state() == SessionState.COMPLETED

    def is_error(self) -> bool:
        """Check if session has error"""
        return self.get_state() == SessionState.ERROR

    def add_on_chunk_callback(self, callback: Callable[[str], None]):
        """
        Add callback for streaming chunks

        Args:
            callback: Function to call for each chunk
        """
        self._on_chunk_callbacks.append(callback)

    def add_on_complete_callback(self, callback: Callable[[str], None]):
        """
        Add callback for complete response

        Args:
            callback: Function to call when response is complete
        """
        self._on_complete_callbacks.append(callback)

    def send(
        self,
        message: str,
        temperature: float = 0.7,
        max_tokens: int = 500,
        **kwargs
    ) -> str:
        """
        Send message and get complete response (batch mode)

        This method waits for the complete response before returning.

        Args:
            message: User message
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters

        Returns:
            str: Complete assistant response
        """
        self._set_state(SessionState.PROCESSING)
        self._current_response = ""
        self._total_messages += 1

        # Add user message to history
        self.messages.append({
            "role": "user",
            "content": message
        })

        # Trim history if needed
        self._trim_history()

        try:
            # Get response
            response = self.client.chat_completion(
                messages=self.messages,
                model=self.model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )

            if 'error' in response:
                self._set_state(SessionState.ERROR)
                error_msg = f"Error: {response['error']}"
                return error_msg

            # Extract response
            assistant_message = response.get('choices', [{}])[0].get('message', {})
            content = self.client._extract_message_content(assistant_message)

            # Add to history
            self.messages.append({
                "role": "assistant",
                "content": content
            })

            # Update cache
            self._current_response = content
            if self.auto_cache:
                self._response_cache.append(content)

            # Update statistics
            usage = response.get('usage', {})
            self._total_tokens += usage.get('total_tokens', 0)

            # Set state
            self._set_state(SessionState.COMPLETED)

            # Call complete callbacks
            for callback in self._on_complete_callbacks:
                try:
                    callback(content)
                except Exception as e:
                    ColorPrint.red(f"[ChatSession] Callback error: {e}")

            return content

        except Exception as e:
            self._set_state(SessionState.ERROR)
            ColorPrint.red(f"[ChatSession] Error: {e}")
            return f"Error: {e}"

    def send_stream(
        self,
        message: str,
        temperature: float = 0.7,
        max_tokens: int = 500,
        **kwargs
    ) -> Iterator[str]:
        """
        Send message and get streaming response

        This method yields chunks as they arrive.

        Args:
            message: User message
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters

        Yields:
            str: Response chunks
        """
        self._set_state(SessionState.PROCESSING)
        self._current_response = ""
        self._total_messages += 1

        # Add user message to history
        self.messages.append({
            "role": "user",
            "content": message
        })

        # Trim history if needed
        self._trim_history()

        try:
            # Collect chunks
            chunks = []

            for chunk in self.client.chat_completion_stream(
                messages=self.messages,
                model=self.model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            ):
                chunks.append(chunk)
                self._current_response += chunk

                # Call chunk callbacks
                for callback in self._on_chunk_callbacks:
                    try:
                        callback(chunk)
                    except Exception as e:
                        ColorPrint.red(f"[ChatSession] Chunk callback error: {e}")

                yield chunk

            # Complete response
            complete_response = ''.join(chunks)

            # Add to history
            self.messages.append({
                "role": "assistant",
                "content": complete_response
            })

            # Update cache
            if self.auto_cache:
                self._response_cache.append(complete_response)

            # Set state
            self._set_state(SessionState.COMPLETED)

            # Call complete callbacks
            for callback in self._on_complete_callbacks:
                try:
                    callback(complete_response)
                except Exception as e:
                    ColorPrint.red(f"[ChatSession] Complete callback error: {e}")

        except Exception as e:
            self._set_state(SessionState.ERROR)
            ColorPrint.red(f"[ChatSession] Stream error: {e}")
            yield f"Error: {e}"

    def get_last_response(self) -> str:
        """
        Get last assistant response

        Returns:
            str: Last response
        """
        return self._current_response

    def get_history(self) -> List[Dict[str, str]]:
        """
        Get message history

        Returns:
            List[Dict]: Message history
        """
        return self.messages.copy()

    def get_response_cache(self) -> List[str]:
        """
        Get response cache

        Returns:
            List[str]: Cached responses
        """
        return self._response_cache.copy()

    def clear_history(self):
        """Clear message history (keep system prompt)"""
        if self.system_prompt:
            self.messages = [{
                "role": "system",
                "content": self.system_prompt
            }]
        else:
            self.messages = []

        self._response_cache = []
        self._current_response = ""
        self._set_state(SessionState.IDLE)

        ColorPrint.blue("[ChatSession] History cleared")

    def _trim_history(self):
        """Trim message history to max_history"""
        if len(self.messages) > self.max_history:
            # Keep system prompt if exists
            if self.system_prompt:
                self.messages = [self.messages[0]] + self.messages[-(self.max_history - 1):]
            else:
                self.messages = self.messages[-self.max_history:]

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get session statistics

        Returns:
            Dict: Statistics
        """
        return {
            'model': self.model,
            'state': self.get_state().value,
            'total_messages': self._total_messages,
            'total_tokens': self._total_tokens,
            'history_count': len(self.messages),
            'cache_count': len(self._response_cache),
        }

    def __repr__(self) -> str:
        """String representation"""
        stats = self.get_statistics()
        return (
            f"ChatSession(model={stats['model']}, "
            f"state={stats['state']}, "
            f"messages={stats['total_messages']}, "
            f"tokens={stats['total_tokens']})"
        )


def list_free_models():
    """
    List all free models available

    Prints all models containing 'free' keyword.
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Available Free Models")
    ColorPrint.green("=" * 70)

    client = get_openrouter_client()
    models = client.get_models()

    free_models = []

    for short_name, full_id in models.items():
        if 'free' in short_name.lower() or 'free' in full_id.lower():
            free_models.append((short_name, full_id))

    if free_models:
        ColorPrint.blue(f"\nFound {len(free_models)} free models:\n")
        for short_name, full_id in free_models:
            ColorPrint.green(f"  • {short_name:30} -> {full_id}")
    else:
        ColorPrint.yellow("\nNo free models found")

    ColorPrint.blue("\n" + "=" * 70)


# Module-level flag to prevent duplicate printing
_free_models_printed = False


def _print_free_models_once():
    """Print free models only once per process"""
    global _free_models_printed
    if not _free_models_printed:
        list_free_models()
        _free_models_printed = True
