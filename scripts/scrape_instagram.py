#!/usr/bin/env python3
"""
Instagram profile scraper using instagrapi.
Usage: python3 scrape_instagram.py <username_or_url>
Requires: pip install instagrapi
"""
import sys
import json
import argparse

try:
    from instagrapi import Client
except ImportError:
    print(json.dumps({"error": "instagrapi not installed. Run: pip install instagrapi"}))
    sys.exit(1)


def extract_handle(input_str: str) -> str:
    """Extract username from URL or return as-is."""
    input_str = input_str.strip().strip('/')
    if 'instagram.com' in input_str.lower():
        parts = input_str.split('/')
        # Remove empty parts from trailing slash
        parts = [p for p in parts if p]
        # Last non-empty part after instagram.com
        try:
            idx = parts.index('instagram.com') if 'instagram.com' in parts else -1
            if idx >= 0 and idx + 1 < len(parts):
                return parts[idx + 1].split('?')[0].split('/')[0]
        except (ValueError, IndexError):
            pass
        # Try to find the username part
        for i, p in enumerate(parts):
            if 'instagram' in p.lower():
                if i + 1 < len(parts):
                    return parts[i + 1].split('?')[0]
        return parts[-1].split('?')[0]
    return input_str.split('?')[0].split('/')[-1]


def scrape_instagram(handle: str) -> dict:
    """
    Scrape public Instagram profile data using instagrapi.
    Uses public (no auth) API - rate limited but works for single calls.
    """
    cl = Client()

    try:
        user_id = cl.user_id_from_username(handle)
        info = cl.user_info(user_id)

        return {
            "handle": handle,
            "full_name": info.full_name or "",
            "bio": info.biography or "",
            "followers": info.follower_count or 0,
            "following": info.following_count or 0,
            "media_count": info.media_count or 0,
            "is_private": info.is_private or False,
            "is_verified": info.is_verified or False,
            "external_url": info.external_url or "",
            "success": True,
            "error": None,
        }
    except Exception as e:
        return {
            "handle": handle,
            "success": False,
            "error": str(e),
            "full_name": "",
            "bio": "",
            "followers": 0,
            "following": 0,
            "media_count": 0,
            "is_private": False,
            "is_verified": False,
            "external_url": "",
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Instagram profile")
    parser.add_argument("handle", help="Instagram username or full URL")
    args = parser.parse_args()

    handle = extract_handle(args.handle)
    result = scrape_instagram(handle)
    print(json.dumps(result, ensure_ascii=False))
