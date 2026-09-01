#!/usr/bin/env python3
"""Sync t.me/s/starkprivacy into data/news.json."""
from __future__ import annotations

import html as html_lib
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CHANNEL = "starkprivacy"
PREVIEW = f"https://t.me/s/{CHANNEL}"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
MAX_PAGES = 120
ARCHIVE_LIMIT = 3000
PAGE_DELAY = 1.2
NEAR_START_ID = 30
