"""
Borelog parser Lambda package.

This module groups the streaming CSV/XLSX parsing utilities that power
the borelog ingestion Lambda. The handler itself lives in
``lambda_handler.py`` while the parsing logic sits in ``parser.py``.
"""

__all__ = ["lambda_handler", "parser"]


