#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Publish OKX application logs through the shared Pycore SSE transport."""

from datetime import datetime

from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service

OKX_LOG_TOPIC = "okx.log"


class LogPublisher:
    def publish(self, level: str, message: str, coin: str = None) -> None:
        log_data = {
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }

        if coin:
            log_data["coin"] = coin
        http_event_delivery_service.publish_topic(OKX_LOG_TOPIC, log_data)


log_publisher = LogPublisher()


__all__ = ["OKX_LOG_TOPIC", "log_publisher"]
