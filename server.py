"""
TikTok LIVE Interactive Studio (v2.0)
=====================================
Step 1: Core Setup
Feature 1: TTS Chat Reader (Microsoft Edge Neural TTS)
Feature 2: Gift Jar (Glass Jar & Real TikTok Gift CDN Icons & Pop Sound)
Feature 3: Subathon Timer (Count Down / Count Up & Time Boost on Gifts)
Feature 4: Top Gifters Leaderboard (Live Top Supporter Cards & Modular Routes)
Feature 5: Coin Match Auction System (TikFinity Style)
Feature 6: CS:GO Style Horizontal Gacha Roulette Wheel System (Flaticon Icons)
Feature 7: Visual Effects & Celebration Animations
  - Canvas 2D Particle Confetti Fireworks Engine
  - Screen Flash & Golden Radial Pulse Effects
  - Floating Supporter Glow Alerts
"""

import asyncio
import aiohttp
import json
import io
import logging
import random
import re
import sys
import time
import urllib.parse
from pathlib import Path
from typing import List, Optional, Dict, Tuple

def parse_time_delta_seconds(item_str: any) -> Optional[int]:
    """
    Parses a gacha item string to seconds if it represents time.
    Supports: "+30", "-15", "10", "+1m", "-2m", "+30s", "-10s", "+1h"
    Supports dict: {"text": "+30", ...}
    Returns None if the string is challenge text (e.g. "วิดพื้น 10 ครั้ง").
    """
    if not item_str:
        return None
    if isinstance(item_str, dict):
        item_str = item_str.get("text") or item_str.get("name") or ""
    s = str(item_str).strip().lower()
    match = re.match(r"^([+-]?\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs)?$", s)
    if not match:
        return None
    val_str, unit = match.groups()
    try:
        val = int(val_str)
        if not unit or unit in ["s", "sec", "secs"]:
            return val
        elif unit in ["m", "min", "mins"]:
            return val * 60
        elif unit in ["h", "hr", "hrs"]:
            return val * 3600
        return val
    except (ValueError, TypeError):
        return None

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from aiohttp import web, WSMsgType

try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    edge_tts = None
    EDGE_TTS_AVAILABLE = False

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    gTTS = None
    GTTS_AVAILABLE = False

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
MEDIA_DIR = BASE_DIR / "media"
MEDIA_DIR.mkdir(exist_ok=True)
SOUNDEFFECT_DIR = BASE_DIR / "Soundeffect"
SOUNDEFFECT_DIR.mkdir(exist_ok=True)
VIDEO_DIR = BASE_DIR / "media" / "Video"
VIDEO_DIR.mkdir(parents=True, exist_ok=True)

GIFT_CACHE_PATH = BASE_DIR / "gift_cache.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("studio-feature7-vfx")

GIFT_CACHE_MAP: Dict[str, dict] = {}
GIFT_CATALOG_LIST: List[dict] = []

def load_gift_cache():
    global GIFT_CACHE_MAP, GIFT_CATALOG_LIST
    if GIFT_CACHE_PATH.exists():
        try:
            with open(GIFT_CACHE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                GIFT_CATALOG_LIST = data.get("gifts", [])
                for g in GIFT_CATALOG_LIST:
                    g_name = (g.get("name") or "").strip()
                    if g_name:
                        GIFT_CACHE_MAP[g_name.lower()] = g
                        clean_k = re.sub(r'[^a-zA-Z0-9]', '', g_name.lower())
                        if clean_k:
                            GIFT_CACHE_MAP[clean_k] = g
            log.info("Loaded %d gifts from gift_cache.json into catalog map", len(GIFT_CATALOG_LIST))
        except Exception as e:
            log.warning("Failed to load gift_cache.json: %s", e)

load_gift_cache()

DEFAULT_CONFIG = {
    "tiktok_username": "your_tiktok_username",
    "tts_config": {
        "enabled": True,
        "voice": "th-TH-PremwadeeNeural",
        "speed": "+0%",
        "pitch": "+0Hz",
        "volume": "+0%",
        "blacklisted_words": ["คำหยาบ1", "คำหยาบ2"],
        "max_length": 100
    },
    "gift_jar_config": {
        "enabled": True,
        "jar_style": "glass_jar",
        "max_items": 120,
        "gravity": 1.0
    },
    "subathon_timer_config": {
        "enabled": True,
        "mode": "countdown",
        "initial_seconds": 3600,
        "max_seconds": 86400,
        "show_progress": True
    },
    "timer_gift_mappings": [
        { "gift_name": "Rose", "action": "add", "seconds_value": 30, "enabled": True },
        { "gift_name": "TikTok", "action": "add", "seconds_value": 30, "enabled": True },
        { "gift_name": "Ice Cream Cone", "action": "add", "seconds_value": 30, "enabled": True },
        { "gift_name": "Finger Heart", "action": "subtract", "seconds_value": 15, "enabled": True },
        { "gift_name": "Doughnut", "action": "add", "seconds_value": 300, "enabled": True },
        { "gift_name": "Lion", "action": "add", "seconds_value": 1800, "enabled": True }
    ],
    "leaderboard_config": {
        "enabled": True,
        "top_count": 5
    },
    "auction_config": {
        "enabled": True,
        "title": "ประมูล: ร้องเพลงตามใจผู้ชนะ",
        "target_coins": 300,
        "duration_seconds": 300,
        "min_increment": 1,
        "auto_extend_sec": 15,
        "celebration_duration_sec": 10,
        "auto_hide_on_end": True,
        "scale": 1.0
    },
    "gacha_config": {
        "enabled": True,
        "items": ["+30", "+15", "+60", "+300", "-30", "-60", "+10", "-15", "+45", "-10"],
        "rarity_names": {
            "legendary": "LEGENDARY",
            "epic": "EPIC",
            "rare": "RARE",
            "common": "COMMON",
            "hazard": "HAZARD",
            "custom": "CUSTOM"
        },
        "spin_duration": 5,
        "trigger_gift_name": "Doughnut",
        "tick_sound_enabled": True,
        "win_sound_enabled": True,
        "scale": 1.0,
        "auto_hide": True
    },
    "vfx_config": {
        "confetti_enabled": True,
        "screen_flash_enabled": True,
        "floating_alerts_enabled": True
    },
    "gift_sound_mappings": [
        { "gift_name": "Rose", "min_count": 1, "sound_file": "dragon-studio-pop-402324.mp3", "volume": 0.8, "enabled": True },
        { "gift_name": "Lion", "min_count": 1, "sound_file": "roesisch-applause-01-253125.mp3", "volume": 1.0, "enabled": True }
    ],
    "gift_video_mappings": [
        { "gift_name": "Lion", "min_count": 1, "video_file": "Homelander Looking at a Big Green Screen.mp4", "position": "center", "scale": 1.0, "volume": 1.0, "enabled": True }
    ],
    "widgets_visibility": {
        "tts": True,
        "jar": True,
        "timer": True,
        "leaderboard": True,
        "auction": True,
        "gacha": True,
        "vfx": True
    }
}

def deep_merge(dict1: dict, dict2: dict) -> dict:
    result = dict(dict1)
    for k, v in dict2.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = v
    return result

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            merged = deep_merge(DEFAULT_CONFIG, cfg)
            return merged
    except Exception:
        return dict(DEFAULT_CONFIG)

def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

def load_gift_catalog() -> dict:
    if not GIFT_CACHE_PATH.exists():
        return {}
    try:
        with open(GIFT_CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            gifts_dict = {}
            for g in data.get("gifts", []):
                if g.get("name") and g.get("icon"):
                    gifts_dict[g["name"].strip().lower()] = g["icon"]
            return gifts_dict
    except Exception as e:
        log.error("Error loading gift_cache.json: %s", e)
        return {}

GIFT_ICONS_MAP = load_gift_catalog()

REAL_TIKTOK_GIFT_ICONS = {
    "rose": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    "rosa": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp",
    "tiktok box": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/802a21ae29f9fae5abe3693de9f874bd~tplv-obj.webp",
    "finger heart": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/dd300fd35a757d751301fba862a258f1~tplv-obj.webp",
    "heart me": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/828ea4e4be96ea9d97034b7f83a45377.png~tplv-obj.webp",
    "paper crane": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/663d274bf74f67c9c0d1eb96d4cebd1b.png~tplv-obj.webp",
    "journey pass": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/9091807d4faef48db8fb48b0a9415c13.png~tplv-obj.webp",
    "doughnut": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp",
    "heart": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/dd300fd35a757d751301fba862a258f1~tplv-obj.webp",
    "lion": "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/resource/1153dd51308c556cb4fcc48c7d62209f.png~tplv-obj.webp"
}

ALIASES = {
    "tiktok box": "tiktok",
    "gg / good game": "gg",
    "good game": "gg",
    "universe": "tiktok universe",
    "ice cream": "ice cream cone",
    "ice cream cone": "ice cream cone",
    "hi": "wink charm",
    "love hand": "finger heart",
    "heart": "finger heart",
    "hand hearts": "finger heart",
    "lollipop": "doughnut",
    "teddy bear": "panda snap",
    "panda": "panda snap",
    "mic": "wild mic",
    "diamond": "diamond gun",
    "popcorn": "chatting popcorn",
    "coffee": "coffee magic",
    "balloon": "balloons",
    "balloons": "balloons",
    "tiktok cap": "cap",
    "goggles": "vr goggles",
    "boxing gloves": "boxing_gloves",
    "boxing": "boxing_gloves",
    "rock star": "rock star",
    "magic castle": "castle_fantasy",
    "castle": "castle",
    "champion trophy": "league_trophy",
    "trophy": "league_trophy",
    "volcano": "volcano",
    "speedboat": "speed boat",
    "speed boat": "speed boat",
    "golden falcon": "golden_falcon",
    "falcon": "falcon",
    "rocket": "flying jets",
    "dragon": "dragon flame",
    "birthday cake": "cake slice",
    "flower bouquet": "xxxl flowers",
    "origami boat": "paper crane",
    "magic mirror": "magic_mirror",
    "mirror": "magic_mirror",
    # Thai gift name aliases
    "กุหลาบ": "rose",
    "โดนัท": "doughnut",
    "สิงโต": "lion",
    "มินิฮาร์ท": "finger heart",
    "หัวใจ": "finger heart",
    "จักรวาล": "tiktok universe",
    "ยูนิเวิร์ส": "tiktok universe",
    "มังกร": "dragon flame",
    "รถสปอร์ต": "sports car",
    "ปืนเงิน": "money gun",
    "หมวก": "cap",
    "ไอศกรีม": "ice cream cone",
    "นกกระดาษ": "paper crane",
    "เค้ก": "cake slice",
    "วาฬ": "whale diving",
    "หงส์": "swan",
    "พลุ": "fireworks",
    "ปราสาท": "castle",
    "จรวด": "flying jets",
    "มวย": "boxing_gloves",
    "ถ้วย": "league_trophy",
    "กาแฟ": "coffee magic",
    "ป๊อปคอร์น": "chatting popcorn",
    "ลูกโป่ง": "balloons",
    "แว่น": "vr goggles",
    "มงกุฎ": "coronet",
    "เป็ด": "baby chicks",
    "ดาว": "tiktok stars"
}

def clean_gift_name(name: str) -> str:
    if not name:
        return ""
    cleaned = re.sub(r'^(gift|ของขวัญ|ไอเทม|\U0001f381)\s*[:\-]?\s*', '', str(name), flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'\s*\((?:ลงโหล|gift|jar|ของขวัญ)\)\s*', '', cleaned, flags=re.IGNORECASE).strip()
    return cleaned

def get_real_gift_icon(gift_name: str) -> str:
    cleaned = clean_gift_name(gift_name)
    name_lower = cleaned.strip().lower()
    if not name_lower:
        return REAL_TIKTOK_GIFT_ICONS.get("rose", "")

    # 1. Direct match in GIFT_CACHE_MAP (from gift_cache.json)
    if name_lower in GIFT_CACHE_MAP and GIFT_CACHE_MAP[name_lower].get("icon"):
        return GIFT_CACHE_MAP[name_lower]["icon"]

    # 2. Check alias in GIFT_CACHE_MAP
    if name_lower in ALIASES:
        target_alias = ALIASES[name_lower].strip().lower()
        if target_alias in GIFT_CACHE_MAP and GIFT_CACHE_MAP[target_alias].get("icon"):
            return GIFT_CACHE_MAP[target_alias]["icon"]

    # 3. Cleaned alphanumeric match in GIFT_CACHE_MAP
    clean_k = re.sub(r'[^a-zA-Z0-9]', '', name_lower)
    if clean_k in GIFT_CACHE_MAP and GIFT_CACHE_MAP[clean_k].get("icon"):
        return GIFT_CACHE_MAP[clean_k]["icon"]

    # 4. Check GIFT_ICONS_MAP / REAL_TIKTOK_GIFT_ICONS
    if name_lower in GIFT_ICONS_MAP:
        return GIFT_ICONS_MAP[name_lower]
    if name_lower in REAL_TIKTOK_GIFT_ICONS:
        return REAL_TIKTOK_GIFT_ICONS[name_lower]
    if name_lower in ALIASES:
        target_alias = ALIASES[name_lower].strip().lower()
        if target_alias in GIFT_ICONS_MAP:
            return GIFT_ICONS_MAP[target_alias]
        if target_alias in REAL_TIKTOK_GIFT_ICONS:
            return REAL_TIKTOK_GIFT_ICONS[target_alias]

    # 5. Fuzzy match in GIFT_CACHE_MAP (for partial queries >= 4 chars)
    if len(name_lower) >= 4:
        for k, g in GIFT_CACHE_MAP.items():
            if name_lower in k or k in name_lower:
                if g.get("icon"):
                    return g["icon"]

    return REAL_TIKTOK_GIFT_ICONS.get("rose", "")

def filter_tts_text(text: str, blacklisted_words: List[str], max_length: int = 100) -> Optional[str]:
    if not text:
        return None
    cleaned = text.strip()
    for word in blacklisted_words:
        if word:
            pattern = re.escape(word)
            cleaned = re.sub(pattern, "***", cleaned, flags=re.IGNORECASE)
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length] + "..."
    return cleaned

# In-Memory States
class JarState:
    def __init__(self):
        self.item_count = 0
        self.total_coins = 0

class SubathonTimerState:
    def __init__(self):
        self.seconds = 3600
        self.initial_seconds = 3600
        self.max_seconds = 86400
        self.is_running = False
        self.mode = "countdown"
        self.total_added_seconds = 0
        self.total_subtracted_seconds = 0
        self.history: List[dict] = []

    def record_change(self, sender: str, gift_name: str, count: int, added_seconds: int, new_total: int, icon_url: str = "") -> dict:
        from datetime import datetime
        now_str = datetime.now().strftime("%H:%M:%S")
        if added_seconds > 0:
            self.total_added_seconds += added_seconds
        elif added_seconds < 0:
            self.total_subtracted_seconds += abs(added_seconds)

        entry = {
            "id": int(time.time() * 1000),
            "time": now_str,
            "sender": sender,
            "gift_name": gift_name,
            "count": count,
            "added_seconds": added_seconds,
            "new_total": new_total,
            "gift_icon": icon_url
        }
        self.history.insert(0, entry)
        if len(self.history) > 200:
            self.history.pop()
        return entry

    def reset_stats(self):
        self.total_added_seconds = 0
        self.total_subtracted_seconds = 0
        self.history.clear()

    def get_stats(self) -> dict:
        return {
            "total_added_seconds": self.total_added_seconds,
            "total_subtracted_seconds": self.total_subtracted_seconds,
            "net_seconds": self.total_added_seconds - self.total_subtracted_seconds,
            "history_count": len(self.history),
            "history": self.history[:50]
        }

GIFT_ALIASES = {
    "rose": ["rose", "ดอกกุหลาบ", "กุหลาบ", "my first rose"],
    "tiktok": ["tiktok", "ติ๊กต๊อก", "tiktok logo", "โลโก้ติ๊กต๊อก"],
    "ice cream cone": ["ice cream cone", "ice cream", "ไอศกรีมโคน", "ไอศครีมโคน", "ไอศกรีม", "ไอติม"],
    "finger heart": ["finger heart", "มินิฮาร์ต", "มินิฮาร์ท", "ส่งใจ", "mini heart"],
    "doughnut": ["doughnut", "donut", "โดนัท"],
    "lion": ["lion", "สิงโต"],
    "heart me": ["heart me", "ฮาร์ตมี"],
    "mini speaker": ["mini speaker", "ลำโพงจิ๋ว"],
    "money gun": ["money gun", "ปืนยิงเงิน"],
    "sports car": ["sports car", "รถสปอร์ต"],
    "universe": ["universe", "tiktok universe", "จักรวาล"],
    "panda": ["panda", "แพนด้า"],
    "swan": ["swan", "หงส์"],
    "whale": ["whale", "ปลาวาฬ", "วาฬ"],
    "cap": ["cap", "หมวกแก๊ป", "หมวก"],
    "fireworks": ["fireworks", "พลุ", "ดอกไม้ไฟ"],
    "coronet": ["coronet", "มงกุฎ"],
    "gamepad": ["gamepad", "จอยเกม"]
}

def normalize_gift_name(name: str) -> str:
    cleaned = (name or "").strip().lower()
    cleaned = re.sub(r'^(ส่งของขวัญ|ส่ง|sent)\s+', '', cleaned)
    cleaned = re.sub(r'\s+(แล้ว|ให้คุณ|to you|!)+$', '', cleaned)
    cleaned = cleaned.strip()

    for canonical, aliases in GIFT_ALIASES.items():
        if cleaned == canonical or cleaned in aliases:
            return canonical
        for a in aliases:
            if a in cleaned or cleaned in a:
                return canonical
    return cleaned

def calculate_timer_gift_addition(gift_name: str, count: int, timer_mappings: List[dict]) -> int:
    """
    Calculates seconds to add/subtract based ONLY on user-configured gift mappings.
    Does NOT add time based on coins.
    Supports English & Thai gift names seamlessly with canonical alias & substring matching.
    Returns 0 if the gift is not configured or not enabled.
    """
    norm_gift = normalize_gift_name(gift_name)
    raw_gift_lower = (gift_name or "").strip().lower()

    for tm in timer_mappings:
        if not tm.get("enabled", True):
            continue
        rule_name = tm.get("gift_name", "").strip()
        if not rule_name:
            continue
        norm_rule = normalize_gift_name(rule_name)
        raw_rule_lower = rule_name.lower()

        matched = False
        if norm_gift == norm_rule:
            matched = True
        elif raw_gift_lower == raw_rule_lower:
            matched = True
        elif len(raw_rule_lower) >= 3 and (raw_rule_lower in raw_gift_lower or raw_gift_lower in raw_rule_lower):
            matched = True
        elif len(norm_rule) >= 3 and (norm_rule in norm_gift or norm_gift in norm_rule):
            matched = True

        if matched:
            action = tm.get("action", "add")
            seconds_value = float(tm.get("seconds_value", 0))
            calc_sec = int(seconds_value * count)
            return -calc_sec if action == "subtract" else calc_sec
    return 0

class LeaderboardState:
    def __init__(self):
        self.gifters: Dict[str, dict] = {}

    def add_gift(self, sender: str, coins: int, gift_name: str, profile_picture: str = "", gift_icon: str = ""):
        if sender not in self.gifters:
            self.gifters[sender] = {
                "sender": sender,
                "coins": 0,
                "last_gift": gift_name,
                "profile_picture": profile_picture,
                "gift_icon": gift_icon
            }
        self.gifters[sender]["coins"] += coins
        self.gifters[sender]["last_gift"] = gift_name
        if profile_picture:
            self.gifters[sender]["profile_picture"] = profile_picture
        if gift_icon:
            self.gifters[sender]["gift_icon"] = gift_icon

    def get_top(self, count: int = 5) -> List[dict]:
        sorted_list = sorted(self.gifters.values(), key=lambda x: x["coins"], reverse=True)
        return sorted_list[:count]

    def reset(self):
        self.gifters.clear()

class TikFinityAuctionState:
    def __init__(self):
        self.title = "ประมูล: ร้องเพลงตามใจผู้ชนะ"
        self.target_coins = 300
        self.min_bid_increment = 1
        self.auto_extend_sec = 15
        self.celebration_duration_sec = 10
        self.auto_hide_on_end = True
        self.scale = 1.0
        self.initial_duration = 300
        self.remaining_seconds = 300
        self.is_active = False
        self.is_paused = False
        self.is_winner_announced = False

        self.bids: Dict[str, int] = {}
        self.bidder_avatars: Dict[str, str] = {}
        self.bidder_last_gifts: Dict[str, str] = {}
        self.bid_history: List[dict] = []
        self.winner_name = "-"
        self.winning_coins = 0
        self.winner_avatar = ""
        self.last_extended = False

    def start(self, title: str, target_coins: int, duration_seconds: int, min_increment: int = 1, auto_extend_sec: int = 15):
        self.title = title
        self.target_coins = target_coins
        self.min_bid_increment = min_increment
        self.auto_extend_sec = auto_extend_sec
        self.initial_duration = duration_seconds
        self.remaining_seconds = duration_seconds
        self.bids.clear()
        self.bidder_avatars.clear()
        self.bidder_last_gifts.clear()
        self.bid_history.clear()
        self.winner_name = "-"
        self.winning_coins = 0
        self.winner_avatar = ""
        self.is_active = True
        self.is_paused = False
        self.is_winner_announced = False
        self.last_extended = False

    def pause(self):
        if self.is_active:
            self.is_paused = True

    def resume(self):
        if self.is_active:
            self.is_paused = False

    def adjust_time(self, seconds: int):
        self.remaining_seconds = max(0, self.remaining_seconds + seconds)

    def process_gift_bid(self, sender: str, coins: int, profile_picture: str = "", gift_name: str = "") -> dict:
        if not self.is_active or self.is_paused:
            return {"accepted": False, "reason": "Auction is not active or paused"}

        current_bid = self.bids.get(sender, 0)
        new_bid = current_bid + coins
        self.bids[sender] = new_bid

        if profile_picture:
            self.bidder_avatars[sender] = profile_picture
        if gift_name:
            self.bidder_last_gifts[sender] = gift_name

        self.bid_history.append({
            "sender": sender,
            "coins": coins,
            "new_total": new_bid,
            "gift_name": gift_name,
            "timestamp": time.strftime("%H:%M:%S")
        })

        top_bidders = self.get_top_bidders(5)
        highest = top_bidders[0] if top_bidders else {"sender": "-", "coins": 0, "profile_picture": ""}

        target_reached = False
        if self.target_coins > 0 and highest["coins"] >= self.target_coins:
            target_reached = True
            self.end()
            if self.is_winner_announced:
                trigger_winner_announcement()

        extended = False
        self.last_extended = False
        if not target_reached and self.auto_extend_sec > 0 and self.remaining_seconds <= self.auto_extend_sec:
            self.remaining_seconds += self.auto_extend_sec
            extended = True
            self.last_extended = True

        return {
            "accepted": True,
            "sender": sender,
            "new_bid": new_bid,
            "highest_bidder": highest["sender"],
            "highest_coins": highest["coins"],
            "highest_avatar": highest.get("profile_picture", ""),
            "target_reached": target_reached,
            "extended": extended,
            "remaining_seconds": self.remaining_seconds
        }

    def get_top_bidders(self, count: int = 5) -> List[dict]:
        sorted_bids = sorted(self.bids.items(), key=lambda x: x[1], reverse=True)
        return [
            {
                "sender": k,
                "coins": v,
                "profile_picture": self.bidder_avatars.get(k, ""),
                "last_gift": self.bidder_last_gifts.get(k, "")
            }
            for k, v in sorted_bids[:count]
        ]

    def end(self):
        self.is_active = False
        self.is_paused = False
        top = self.get_top_bidders(1)
        if top and top[0]["coins"] > 0:
            self.winner_name = top[0]["sender"]
            self.winning_coins = top[0]["coins"]
            self.winner_avatar = top[0].get("profile_picture", "")
            self.is_winner_announced = True
        else:
            self.winner_name = "-"
            self.winning_coins = 0
            self.winner_avatar = ""
            self.is_winner_announced = False

    def dismiss_winner(self):
        self.is_winner_announced = False

    def reset(self):
        self.is_active = False
        self.is_paused = False
        self.is_winner_announced = False
        self.bids.clear()
        self.bidder_avatars.clear()
        self.bidder_last_gifts.clear()
        self.bid_history.clear()
        self.winner_name = "-"
        self.winning_coins = 0
        self.winner_avatar = ""
        self.remaining_seconds = self.initial_duration
        self.last_extended = False

    def to_dict(self) -> dict:
        top_bidders = self.get_top_bidders(5)
        highest = top_bidders[0] if top_bidders else {"sender": "-", "coins": 0, "profile_picture": ""}
        is_unlimited = bool(self.target_coins <= 0)
        return {
            "title": self.title,
            "target_coins": self.target_coins,
            "is_unlimited": is_unlimited,
            "unlimited_coins": is_unlimited,
            "highest_bidder": highest["sender"],
            "highest_bid": highest["coins"],
            "highest_avatar": highest.get("profile_picture", ""),
            "top_bidders": top_bidders,
            "remaining_seconds": self.remaining_seconds,
            "initial_duration": self.initial_duration,
            "is_active": self.is_active,
            "is_paused": self.is_paused,
            "is_winner_announced": self.is_winner_announced,
            "winner_name": self.winner_name,
            "winning_coins": self.winning_coins,
            "winner_avatar": self.winner_avatar,
            "auto_extend_sec": self.auto_extend_sec,
            "min_bid_increment": self.min_bid_increment,
            "bid_count": len(self.bid_history),
            "last_extended": self.last_extended,
            "celebration_duration_sec": self.celebration_duration_sec,
            "auto_hide_on_end": self.auto_hide_on_end,
            "scale": self.scale
        }

jar_state = JarState()
timer_state = SubathonTimerState()
leaderboard_state = LeaderboardState()
auction_state = TikFinityAuctionState()

auto_dismiss_auction_task: Optional[asyncio.Task] = None

async def auto_dismiss_winner_task(delay_sec: int):
    try:
        await asyncio.sleep(delay_sec)
        if auction_state.is_winner_announced:
            auction_state.dismiss_winner()
            log.info("[AUCTION] Auction winner celebration auto-dismissed after %ds", delay_sec)
            await broadcast({
                "type": "auction_dismiss_winner",
                "auction": auction_state.to_dict()
            })
    except asyncio.CancelledError:
        pass

def trigger_winner_announcement():
    global auto_dismiss_auction_task
    if auto_dismiss_auction_task and not auto_dismiss_auction_task.done():
        auto_dismiss_auction_task.cancel()
    cfg = load_config()
    delay = int(cfg.get("auction_config", {}).get("celebration_duration_sec", 10))
    auto_dismiss_auction_task = asyncio.create_task(auto_dismiss_winner_task(delay))

last_gacha_play_time = 0.0

ws_clients: set[web.WebSocketResponse] = set()

async def broadcast(payload: dict) -> None:
    if not ws_clients:
        return
    message = json.dumps(payload, ensure_ascii=False)
    dead = []
    for ws in list(ws_clients):
        try:
            await ws.send_str(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_clients.discard(ws)

# Background Subathon Timer & Auction Timer Loop
async def timer_background_task():
    while True:
        await asyncio.sleep(1)
        if timer_state.is_running:
            if timer_state.mode == "countdown":
                if timer_state.seconds > 0:
                    timer_state.seconds -= 1
                else:
                    timer_state.is_running = False
            else:
                timer_state.seconds += 1

            await broadcast({
                "type": "timer_tick",
                "seconds": timer_state.seconds,
                "initial_seconds": timer_state.initial_seconds,
                "max_seconds": timer_state.max_seconds,
                "is_running": timer_state.is_running,
                "mode": timer_state.mode
            })

        if auction_state.is_active and not auction_state.is_paused:
            if auction_state.remaining_seconds > 0:
                auction_state.remaining_seconds -= 1
                await broadcast({
                    "type": "auction_tick",
                    "auction": auction_state.to_dict()
                })
            else:
                auction_state.end()
                if auction_state.is_winner_announced:
                    trigger_winner_announcement()
                await broadcast({
                    "type": "auction_winner",
                    "winner": auction_state.winner_name,
                    "winning_bid": auction_state.winning_coins,
                    "winner_avatar": auction_state.winner_avatar,
                    "auction": auction_state.to_dict()
                })

# CS:GO Style Gacha Reel Generator
def generate_gacha_reel_sequence(pool_items: List[str], winner_item: str, reel_length: int = 50) -> Tuple[List[str], int]:
    reel = [random.choice(pool_items) for _ in range(reel_length)]
    winner_index = reel_length - 6
    reel[winner_index] = winner_item
    return reel, winner_index

def resolve_gacha_gift_reward(winner_item: any, cfg: dict) -> Optional[dict]:
    if not winner_item:
        return None
    g_name = ""
    g_count = 1
    is_explicit_gift = False
    if isinstance(winner_item, dict):
        if winner_item.get("type") == "gift" or winner_item.get("is_gift") or winner_item.get("gift_name"):
            g_name = winner_item.get("gift_name") or winner_item.get("text") or winner_item.get("name") or ""
            g_count = int(winner_item.get("count") or 1)
            is_explicit_gift = True
        else:
            g_name = str(winner_item.get("text") or winner_item.get("name") or "").strip()
    else:
        g_name = str(winner_item).strip()

    if not g_name:
        return None

    if parse_time_delta_seconds(g_name) is not None:
        return None

    cleaned = re.sub(r'^(gift|ของขวัญ|ไอเทม|\U0001f381)\s*[:\-]?\s*', '', g_name, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'\s*\((?:ลงโหล|gift|jar)\)\s*', '', cleaned, flags=re.IGNORECASE).strip()
    lower = cleaned.lower()

    if is_explicit_gift:
        return {"name": cleaned, "count": g_count}

    if lower in GIFT_ICONS_MAP or lower in REAL_TIKTOK_GIFT_ICONS:
        return {"name": cleaned, "count": g_count}

    for m in cfg.get("gift_sound_mappings", []):
        if m.get("gift_name", "").strip().lower() == lower:
            return {"name": cleaned, "count": g_count}

    for vm in cfg.get("gift_video_mappings", []):
        if vm.get("gift_name", "").strip().lower() == lower:
            return {"name": cleaned, "count": g_count}

    return None

async def schedule_gacha_gift_drop(delay: float, gift_info: dict, sender: str, profile_pic: str, cfg: dict):
    await asyncio.sleep(delay)
    g_name = gift_info["name"]
    g_count = gift_info.get("count", 1)
    s_url = None
    s_vol = 1.0
    for m in cfg.get("gift_sound_mappings", []):
        if m.get("enabled", True) and m.get("gift_name", "").strip().lower() == g_name.strip().lower():
            sf = m.get("sound_file")
            if sf:
                s_url = f"/soundeffect/{sf}"
                s_vol = float(m.get("volume", 1.0))
                break
    if not s_url:
        s_url = "/soundeffect/dragon-studio-pop-402324.mp3"

    video_alert_data = None
    for vm in cfg.get("gift_video_mappings", []):
        if vm.get("enabled", True) and vm.get("gift_name", "").strip().lower() == g_name.strip().lower():
            v_file = vm.get("video_file")
            if v_file:
                video_alert_data = {
                    "url": f"/media/Video/{urllib.parse.quote(v_file)}",
                    "video_file": v_file,
                    "position": vm.get("position", "center"),
                    "scale": float(vm.get("scale", 1.0)),
                    "volume": float(vm.get("volume", 1.0))
                }
                break

    g_icon = get_real_gift_icon(g_name) or f"/api/gift-icon?name={urllib.parse.quote(g_name)}"

    jar_state.item_count += g_count
    jar_state.total_coins += 50 * g_count

    log.info("[GACHA] CS:GO Gacha Won Gift Dropping into Jar: '%s' x%d for %s (sound=%s, video=%s)", g_name, g_count, sender, s_url, bool(video_alert_data))
    await broadcast({
        "type": "gift",
        "target_widget": "all",
        "gift_name": g_name,
        "gift_icon": g_icon,
        "count": g_count,
        "coins": 50 * g_count,
        "sender": f"Gacha ({sender})",
        "profile_picture": profile_pic,
        "sound_effect": s_url,
        "sound_volume": s_vol,
        "video_alert": video_alert_data,
        "video_effect": video_alert_data,
        "jar_count": jar_state.item_count,
        "jar_total_coins": jar_state.total_coins,
        "is_gacha_reward": True
    })

# HTTP Handlers
async def handle_dashboard(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "dashboard.html", headers={"Cache-Control": "no-store"})

async def handle_overlay(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay.html", headers={"Cache-Control": "no-store"})

# Modular Routes for TikTok LIVE Studio
async def handle_overlay_jar(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay_jar.html", headers={"Cache-Control": "no-store"})

async def handle_overlay_timer(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay_timer.html", headers={"Cache-Control": "no-store"})

async def handle_overlay_leaderboard(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay_leaderboard.html", headers={"Cache-Control": "no-store"})

async def handle_overlay_tts(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay_tts.html", headers={"Cache-Control": "no-store"})

async def handle_overlay_auction(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay_auction.html", headers={"Cache-Control": "no-store"})

async def handle_overlay_gacha(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay_gacha.html", headers={"Cache-Control": "no-store"})

async def handle_overlay_vfx(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "overlay.html", headers={"Cache-Control": "no-store"})

async def handle_get_config(request: web.Request) -> web.Response:
    return web.json_response(load_config())

async def handle_post_config(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    current_cfg = load_config()
    merged = deep_merge(current_cfg, data)
    save_config(merged)
    await broadcast({"type": "config_updated", "config": merged})
    top_cnt = int(merged.get("leaderboard_config", {}).get("top_count", 5))
    if "auction_config" in merged:
        ac = merged["auction_config"]
        if "title" in ac and not auction_state.is_active:
            auction_state.title = ac["title"]
        if "target_coins" in ac and not auction_state.is_active:
            if ac.get("unlimited") or ac.get("unlimited_coins"):
                auction_state.target_coins = 0
            else:
                auction_state.target_coins = int(ac["target_coins"])
        if "duration_seconds" in ac and not auction_state.is_active:
            auction_state.remaining_seconds = int(ac["duration_seconds"])
            auction_state.initial_duration = int(ac["duration_seconds"])
        if "auto_extend_sec" in ac:
            auction_state.auto_extend_sec = int(ac["auto_extend_sec"])
        if "min_increment" in ac:
            auction_state.min_bid_increment = int(ac["min_increment"])
        if "celebration_duration_sec" in ac:
            auction_state.celebration_duration_sec = int(ac["celebration_duration_sec"])
        if "auto_hide_on_end" in ac:
            auction_state.auto_hide_on_end = bool(ac["auto_hide_on_end"])
        if "scale" in ac:
            auction_state.scale = float(ac["scale"])
        await broadcast({"type": "auction_update", "auction": auction_state.to_dict()})
    return web.json_response({"ok": True, "config": merged})

async def handle_status(request: web.Request) -> web.Response:
    cfg = load_config()
    top_cnt = int(cfg.get("leaderboard_config", {}).get("top_count", 5))
    return web.json_response({
        "status": "connected_local",
        "overlay_clients": len(ws_clients),
        "jar_item_count": jar_state.item_count,
        "jar_total_coins": jar_state.total_coins,
        "timer_seconds": timer_state.seconds,
        "timer_running": timer_state.is_running,
        "timer_stats": timer_state.get_stats(),
        "top_gifters": leaderboard_state.get_top(top_cnt),
        "auction": auction_state.to_dict()
    })

async def handle_get_timer_history(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "timer_stats": timer_state.get_stats()})

async def handle_clear_timer_history(request: web.Request) -> web.Response:
    timer_state.reset_stats()
    stats = timer_state.get_stats()
    await broadcast({"type": "timer_stats_cleared", "timer_stats": stats})
    return web.json_response({"ok": True, "timer_stats": stats})

async def handle_list_sounds(request: web.Request) -> web.Response:
    sounds = []
    for p in SOUNDEFFECT_DIR.glob("*.*"):
        if p.suffix.lower() in [".mp3", ".wav", ".ogg", ".m4a"]:
            sounds.append({
                "name": p.name,
                "url": f"/soundeffect/{p.name}",
                "size_kb": round(p.stat().st_size / 1024, 1)
            })
    return web.json_response({"sounds": sounds})

def sanitize_upload_filename(raw_name: str, allowed_exts: list) -> str:
    p = Path(raw_name)
    ext = p.suffix.lower()
    if not ext or ext not in allowed_exts:
        return ""
    stem = p.stem.strip()
    # Replace dangerous path characters, preserving Unicode letters, numbers, spaces, and hyphens
    clean_stem = re.sub(r'[\/\\:\*\?\"<>\|\x00-\x1f]+', '_', stem).strip()
    if not clean_stem:
        clean_stem = "upload_" + hashlib.md5(raw_name.encode('utf-8', 'ignore')).hexdigest()[:8]
    return f"{clean_stem}{ext}"

async def handle_upload_sound(request: web.Request) -> web.Response:
    try:
        reader = await request.multipart()
        field = await reader.next()
        if not field or field.name != 'file':
            return web.json_response({"ok": False, "error": "Missing file field"}, status=400)
        
        filename = field.filename or ""
        safe_filename = sanitize_upload_filename(filename, ['.mp3', '.wav', '.ogg', '.m4a'])
        if not safe_filename:
            return web.json_response({"ok": False, "error": "Only audio files (.mp3, .wav, .ogg, .m4a) are allowed"}, status=400)
        
        file_path = SOUNDEFFECT_DIR / safe_filename
        
        size = 0
        with open(file_path, 'wb') as f:
            while True:
                chunk = await field.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                f.write(chunk)
                
        log.info("Uploaded custom sound: %s (%d bytes)", safe_filename, size)
        return web.json_response({
            "ok": True, 
            "message": f"Successfully uploaded {safe_filename}", 
            "filename": safe_filename,
            "url": f"/soundeffect/{safe_filename}"
        })
    except Exception as e:
        log.error("Upload sound error: %s", e)
        return web.json_response({"ok": False, "error": str(e)}, status=500)

ICON_CACHE_DIR = BASE_DIR / "media" / "icons"
ICON_CACHE_DIR.mkdir(parents=True, exist_ok=True)

import hashlib

async def handle_gift_icon_proxy(request: web.Request) -> web.Response:
    raw_name = request.query.get("name", "rose").strip()
    gift_name = clean_gift_name(raw_name).lower() or "rose"
    raw_url = request.query.get("url")
    gift_id = request.query.get("id", "").strip()
    safe_name = re.sub(r'[^\w\.-]', '_', gift_name)

    # 1. Determine icon URL — prefer explicit ?url= param, then lookup by gift ID, then by name
    if raw_url and raw_url.startswith("http"):
        icon_url = raw_url
    elif gift_id and gift_id.isdigit():
        matched = next((g for g in GIFT_CATALOG_LIST if str(g.get("id")) == gift_id), None)
        icon_url = matched["icon"] if matched and matched.get("icon") else get_real_gift_icon(gift_name)
    else:
        icon_url = get_real_gift_icon(gift_name)

    # 2. Cache key: use URL hash to guarantee unique file per icon (avoids name collisions)
    if icon_url and icon_url.startswith("http"):
        url_hash = hashlib.md5(icon_url.encode('utf-8')).hexdigest()[:12]
        cached_file = ICON_CACHE_DIR / f"_c{url_hash}.webp"
    else:
        cached_file = ICON_CACHE_DIR / f"{safe_name}.webp"

    # 3. Serve from disk cache if present
    if cached_file.exists() and cached_file.stat().st_size > 0:
        with open(cached_file, "rb") as f:
            return web.Response(body=f.read(), content_type="image/webp",
                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=604800"})

    # 4. Fetch from TikTok CDN
    if icon_url and icon_url.startswith("http"):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.tiktok.com/"
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(icon_url, headers=headers, ssl=False, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status == 200:
                        img_data = await resp.read()
                        if len(img_data) > 0:
                            try:
                                with open(cached_file, "wb") as cf:
                                    cf.write(img_data)
                            except Exception:
                                pass
                            ct = resp.headers.get("Content-Type", "image/webp")
                            return web.Response(body=img_data, content_type=ct,
                                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=604800"})
        except Exception as e:
            log.warning("Gift icon CDN fetch failed for '%s': %s", raw_name, e)

    # 5. Fallback: rose.webp on disk
    rose_fallback = ICON_CACHE_DIR / "rose.webp"
    if rose_fallback.exists() and rose_fallback.stat().st_size > 0:
        with open(rose_fallback, "rb") as f:
            return web.Response(body=f.read(), content_type="image/webp",
                headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400"})

    # 6. SVG placeholder
    label = (raw_name[:4] if raw_name else "GIFT").upper()
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fe2c55"/><stop offset="100%" stop-color="#25f4ee"/>
      </linearGradient></defs>
      <rect width="100" height="100" rx="20" fill="url(#g)"/>
      <text x="50" y="58" font-size="22" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">{label}</text>
    </svg>'''
    return web.Response(text=svg, content_type="image/svg+xml",
        headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600"})

async def handle_tiktok_coin(request: web.Request) -> web.Response:
    coin_file = MEDIA_DIR / "tiktok_coin.svg"
    if coin_file.exists():
        with open(coin_file, "rb") as f:
            return web.Response(body=f.read(), content_type="image/svg+xml", headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400"})
    return web.Response(status=404, text="Coin icon not found")

AVATAR_CACHE_DIR = BASE_DIR / "media" / "avatars"
AVATAR_CACHE_DIR.mkdir(parents=True, exist_ok=True)

async def handle_avatar_proxy(request: web.Request) -> web.Response:
    raw_url = request.query.get("url", "").strip()
    user_name = request.query.get("name", "").strip()
    
    if raw_url and raw_url.startswith("http"):
        url_hash = hashlib.md5(raw_url.encode('utf-8')).hexdigest()[:12]
        cached_file = AVATAR_CACHE_DIR / f"avatar_{url_hash}.webp"
        
        if cached_file.exists() and cached_file.stat().st_size > 0:
            with open(cached_file, "rb") as f:
                return web.Response(body=f.read(), content_type="image/webp", headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400"})

        try:
            req_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(raw_url, headers=req_headers, ssl=False, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.read()
                        if len(data) > 0:
                            with open(cached_file, "wb") as f:
                                f.write(data)
                            c_type = resp.headers.get("Content-Type", "image/webp")
                            return web.Response(body=data, content_type=c_type, headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400"})
        except Exception as e:
            log.warning("Could not proxy avatar from %s: %s", raw_url[:40], e)

    # SVG Fallback based on user name or initial
    first_char = (user_name[:1] if user_name else "U").upper()
    colors = ["#f59e0b", "#3b82f6", "#ec4899", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"]
    bg_color = colors[abs(hash(user_name or "U")) % len(colors)]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="50" fill="{bg_color}"/>
      <text x="50" y="65" font-size="44" font-family="sans-serif" font-weight="900" fill="#ffffff" text-anchor="middle">{first_char}</text>
    </svg>'''
    return web.Response(text=svg, content_type="image/svg+xml", headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600"})

async def handle_delete_sound(request: web.Request) -> web.Response:
    try:
        filename = request.query.get("filename", "").strip()
        if not filename:
            return web.json_response({"ok": False, "error": "Missing filename"}, status=400)
        
        safe_filename = Path(filename).name
        target = SOUNDEFFECT_DIR / safe_filename
        if target.exists() and target.is_file():
            target.unlink()
            log.info("Deleted sound file: %s", safe_filename)
            return web.json_response({"ok": True, "message": f"Deleted {safe_filename}"})
        else:
            return web.json_response({"ok": False, "error": "File not found"}, status=404)
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)

async def handle_list_videos(request: web.Request) -> web.Response:
    videos = []
    if VIDEO_DIR.exists():
        for p in VIDEO_DIR.glob("*.*"):
            if p.suffix.lower() in [".mp4", ".webm", ".mov"]:
                videos.append({
                    "name": p.name,
                    "url": f"/media/Video/{urllib.parse.quote(p.name)}",
                    "size_mb": round(p.stat().st_size / (1024 * 1024), 2)
                })
    return web.json_response({"videos": sorted(videos, key=lambda x: x["name"])})

async def handle_upload_video(request: web.Request) -> web.Response:
    try:
        reader = await request.multipart()
        field = await reader.next()
        if not field or field.name != 'file':
            return web.json_response({"ok": False, "error": "Missing file field"}, status=400)
        
        filename = field.filename or ""
        safe_filename = sanitize_upload_filename(filename, ['.mp4', '.webm', '.mov'])
        if not safe_filename:
            return web.json_response({"ok": False, "error": "Only video files (.mp4, .webm, .mov) are allowed"}, status=400)
        
        file_path = VIDEO_DIR / safe_filename
        
        size = 0
        with open(file_path, 'wb') as f:
            while True:
                chunk = await field.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                f.write(chunk)
                
        log.info("Uploaded custom video: %s (%d bytes)", safe_filename, size)
        return web.json_response({
            "ok": True, 
            "message": f"Successfully uploaded {safe_filename}", 
            "filename": safe_filename,
            "url": f"/media/Video/{urllib.parse.quote(safe_filename)}"
        })
    except Exception as e:
        log.error("Upload video error: %s", e)
        return web.json_response({"ok": False, "error": str(e)}, status=500)

async def handle_delete_video(request: web.Request) -> web.Response:
    try:
        filename = request.query.get("filename", "").strip()
        if not filename:
            return web.json_response({"ok": False, "error": "Missing filename"}, status=400)
        
        safe_filename = Path(filename).name
        target = VIDEO_DIR / safe_filename
        if target.exists() and target.is_file():
            target.unlink()
            log.info("Deleted video file: %s", safe_filename)
            return web.json_response({"ok": True, "message": f"Deleted {safe_filename}"})
        else:
            return web.json_response({"ok": False, "error": "File not found"}, status=404)
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)

async def handle_overlay_video(request: web.Request) -> web.Response:
    path = BASE_DIR / "overlay_video.html"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return web.Response(text=f.read(), content_type="text/html")
    return web.Response(status=404, text="overlay_video.html not found")

async def handle_tts_audio(request: web.Request) -> web.Response:
    text = request.query.get("text", "").strip()
    voice = request.query.get("voice", "th-TH-PremwadeeNeural")
    if "nawat" in voice.lower() or "niwat" in voice.lower():
        voice = "th-TH-PremwadeeNeural"
    speed = request.query.get("speed", "+0%").strip()

    if not text:
        return web.Response(status=400, text="Missing text query param")

    try:
        if EDGE_TTS_AVAILABLE:
            communicate = edge_tts.Communicate(text, voice, rate=speed)
            fp = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    fp.write(chunk["data"])
            fp.seek(0)
            return web.Response(body=fp.read(), content_type="audio/mpeg", headers={"Cache-Control": "public, max-age=3600"})

        elif GTTS_AVAILABLE:
            def generate_gtts():
                tts = gTTS(text=text, lang="th")
                fp_gtts = io.BytesIO()
                tts.write_to_fp(fp_gtts)
                fp_gtts.seek(0)
                return fp_gtts.read()

            mp3_data = await asyncio.to_thread(generate_gtts)
            return web.Response(body=mp3_data, content_type="audio/mpeg", headers={"Cache-Control": "public, max-age=3600"})
        else:
            return web.Response(status=500, text="No TTS library available")

    except Exception as e:
        log.error("TTS Generation Error: %s", e)
        return web.Response(status=500, text=str(e))

async def handle_mock_event(request: web.Request) -> web.Response:
    global last_gacha_play_time

    try:
        data = await request.json()
    except Exception as exc:
        return web.json_response({"ok": False, "error": f"Invalid JSON: {exc}"}, status=400)

    try:
        event_type = data.get("event_type") or data.get("type") or "ping"

        if event_type == "ping":
            payload = {"type": "ping", "message": "Pong from Backend Simulator!", "is_mock": True}
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "chat":
            sender = data.get("sender", "Viewer_123")
            text = data.get("text", "สวัสดีครับ ขอเพลงด้วยครับ")
            cfg = load_config()
            tts_cfg = cfg.get("tts_config", {})

            filtered_text = filter_tts_text(
                text,
                blacklisted_words=tts_cfg.get("blacklisted_words", []),
                max_length=tts_cfg.get("max_length", 100)
            )

            speech_text = filtered_text or text
            encoded_text = urllib.parse.quote(speech_text)
            selected_voice = tts_cfg.get("voice", "th-TH-PremwadeeNeural")
            selected_speed = urllib.parse.quote(tts_cfg.get("speed", "+0%"))

            payload = {
                "type": "tts_chat",
                "sender": sender,
                "text": speech_text,
                "raw_text": text,
                "audio_url": f"/api/tts?text={encoded_text}&voice={selected_voice}&speed={selected_speed}",
                "config": tts_cfg,
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "gift":
            target_widget = data.get("target_widget", "all")
            gift_name = data.get("gift_name", "Rose")
            sender = data.get("sender", "Supporter_007")
            profile_picture = data.get("profile_picture") or data.get("profilePictureUrl") or ""
            count = int(data.get("count", 1))
            coins = int(data.get("coins", 1)) * count
            
            raw_icon = data.get("gift_icon") or data.get("giftIcon")
            if raw_icon and str(raw_icon).startswith("http"):
                icon_url = str(raw_icon)
            else:
                icon_url = get_real_gift_icon(gift_name) or f"/api/gift-icon?name={urllib.parse.quote(gift_name)}"

            if target_widget in ["all", "jar"]:
                jar_state.item_count += count
                jar_state.total_coins += coins

            cfg = load_config()
            timer_cfg = cfg.get("subathon_timer_config", {})
            timer_mappings = cfg.get("timer_gift_mappings", [])
            added_seconds = 0

            log.info("[GIFT] Incoming Gift: '%s' x%d from %s (coins=%d, target_widget=%s)", gift_name, count, sender, coins, target_widget)

            if timer_cfg.get("enabled", True):
                # Calculate time modification strictly based on user-configured gift mappings
                added_seconds = calculate_timer_gift_addition(gift_name, count, timer_mappings)

                if added_seconds != 0:
                    if timer_state.mode == "countdown":
                        timer_state.seconds = max(0, timer_state.seconds + added_seconds)
                    else:
                        timer_state.seconds = max(0, timer_state.seconds - added_seconds)
                    log_entry = timer_state.record_change(sender, gift_name, count, added_seconds, timer_state.seconds, icon_url)
                    log.info("[TIMER] Timer updated by '%s': added=%ds, new_total=%ds", gift_name, added_seconds, timer_state.seconds)
                    await broadcast({
                        "type": "timer_update",
                        "seconds": timer_state.seconds,
                        "is_running": timer_state.is_running,
                        "mode": timer_state.mode,
                        "initial_seconds": timer_state.initial_seconds,
                        "max_seconds": timer_state.max_seconds,
                        "added_seconds": added_seconds,
                        "timer_stats": timer_state.get_stats(),
                        "log_entry": log_entry
                    })
                else:
                    log.info("[GIFT] Gift '%s' has no matching rule or added_seconds=0", gift_name)

            if target_widget in ["all", "leaderboard"]:
                leaderboard_state.add_gift(sender, coins, gift_name, profile_picture, icon_url)
            top_cnt = int(cfg.get("leaderboard_config", {}).get("top_count", 5))
            top_list = leaderboard_state.get_top(top_cnt)

            bid_result = {}
            if target_widget in ["all", "auction"]:
                bid_result = auction_state.process_gift_bid(sender, coins, profile_picture, gift_name)

            # CS:GO Gacha Trigger Check
            gacha_cfg = cfg.get("gacha_config", {})
            gacha_enabled = gacha_cfg.get("enabled", True)
            trigger_gift_name = gacha_cfg.get("trigger_gift_name", "Doughnut").strip().lower()

            gift_name_lower = gift_name.strip().lower()
            trigger_matched = (gift_name_lower == trigger_gift_name)

            gacha_spin_data = None
            if gacha_enabled and (target_widget == "gacha" or (target_widget == "all" and trigger_matched)):
                pool_items = gacha_cfg.get("items", ["+30", "+15", "+60", "+300", "-30", "-60", "+10", "-15", "+45", "-10"])
                duration = int(gacha_cfg.get("spin_duration", 5))
                winner_item = random.choice(pool_items)
                reel_sequence, winner_index = generate_gacha_reel_sequence(pool_items, winner_item, reel_length=50)

                # Auto Apply to Subathon Timer if item is time delta
                sec_delta = parse_time_delta_seconds(winner_item)
                winner_label = winner_item.get("text", "") if isinstance(winner_item, dict) else str(winner_item)
                if sec_delta is not None:
                    if timer_state.mode == "countdown":
                        timer_state.seconds = max(0, timer_state.seconds + sec_delta)
                    else:
                        timer_state.seconds = max(0, timer_state.seconds - sec_delta)
                    gacha_log_entry = timer_state.record_change(
                        sender,
                        f"[GACHA] CS:GO Gacha ({winner_label})",
                        1,
                        sec_delta,
                        timer_state.seconds,
                        icon_url
                    )
                    log.info("[GACHA] Gacha result '%s': delta=%ds, new_timer=%ds", winner_label, sec_delta, timer_state.seconds)
                    await broadcast({
                        "type": "timer_update",
                        "seconds": timer_state.seconds,
                        "is_running": timer_state.is_running,
                        "mode": timer_state.mode,
                        "initial_seconds": timer_state.initial_seconds,
                        "max_seconds": timer_state.max_seconds,
                        "added_seconds": sec_delta,
                        "timer_stats": timer_state.get_stats(),
                        "log_entry": gacha_log_entry
                    })

                gacha_spin_data = {
                    "type": "gacha_spin",
                    "winner_item": winner_item,
                    "reel_sequence": reel_sequence,
                    "winner_index": winner_index,
                    "duration": duration,
                    "timer_seconds": timer_state.seconds,
                    "trigger_gift": gift_name,
                    "trigger_gift_icon": icon_url,
                    "sender": sender,
                    "sender_avatar": profile_picture,
                    "time_delta_seconds": sec_delta,
                    "config": gacha_cfg
                }
                won_gift = resolve_gacha_gift_reward(winner_item, cfg)
                if won_gift:
                    gacha_spin_data["won_gift"] = won_gift
                    asyncio.create_task(schedule_gacha_gift_drop(duration, won_gift, sender, profile_picture, cfg))
                await broadcast(gacha_spin_data)

            # User Configured Per-Gift Sound Mapping Lookup
            gift_mappings = cfg.get("gift_sound_mappings", [])
            gacha_sound_url = None
            sound_vol = 1.0

            for m in gift_mappings:
                if m.get("enabled", True) and m.get("gift_name", "").strip().lower() == gift_name.strip().lower():
                    if count >= int(m.get("min_count", 1)):
                        s_file = m.get("sound_file")
                        if s_file:
                            gacha_sound_url = f"/soundeffect/{s_file}"
                            sound_vol = float(m.get("volume", 1.0))
                            break

            if not gacha_sound_url:
                gacha_sound_url = "/soundeffect/dragon-studio-pop-402324.mp3"

            # User Configured Per-Gift Video Mapping Lookup
            video_mappings = cfg.get("gift_video_mappings", [])
            video_alert_data = None
            for vm in video_mappings:
                if vm.get("enabled", True) and vm.get("gift_name", "").strip().lower() == gift_name.strip().lower():
                    if count >= int(vm.get("min_count", 1)):
                        v_file = vm.get("video_file")
                        if v_file:
                            video_alert_data = {
                                "url": f"/media/Video/{urllib.parse.quote(v_file)}",
                                "video_file": v_file,
                                "position": vm.get("position", "center"),
                                "scale": float(vm.get("scale", 1.0)),
                                "volume": float(vm.get("volume", 1.0))
                            }
                            break

            payload = {
                "type": "gift",
                "target_widget": target_widget,
                "gift_name": gift_name,
                "gift_icon": icon_url,
                "sender": sender,
                "profile_picture": profile_picture,
                "count": count,
                "coins": coins,
                "jar_count": jar_state.item_count,
                "jar_total_coins": jar_state.total_coins,
                "sound_effect": gacha_sound_url,
                "sound_volume": sound_vol,
                "video_effect": video_alert_data,
                "video_alert": video_alert_data,
                "added_seconds": added_seconds,
                "timer_seconds": timer_state.seconds,
                "timer_stats": timer_state.get_stats(),
                "log_entry": log_entry if 'log_entry' in locals() else None,
                "top_gifters": top_list,
                "auction": auction_state.to_dict(),
                "bid_result": bid_result,
                "gacha_spin": gacha_spin_data,
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "stop_audio":
            payload = {"type": "stop_audio"}
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "tts_control":
            action = data.get("action", "toggle")
            cfg = load_config()
            vis = cfg.get("widgets_visibility", {})
            if action in ["hide", "close"]:
                vis["tts"] = False
            elif action in ["show", "open"]:
                vis["tts"] = True
            elif action == "toggle":
                vis["tts"] = not vis.get("tts", True)
            elif action == "clear":
                clear_payload = {"type": "tts_clear", "is_mock": True}
                await broadcast(clear_payload)
                return web.json_response({"ok": True, "broadcast": clear_payload})

            cfg["widgets_visibility"] = vis
            save_config(cfg)
            payload = {
                "type": "tts_visibility",
                "visible": vis.get("tts", True),
                "is_mock": True
            }
            await broadcast(payload)
            await broadcast({
                "type": "config_updated",
                "config": cfg,
                "is_mock": True
            })
            return web.json_response({"ok": True, "visible": vis.get("tts", True), "broadcast": payload})

        elif event_type == "reset_jar":
            jar_state.item_count = 0
            jar_state.total_coins = 0
            payload = {"type": "jar_reset", "is_mock": True}
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "timer_control":
            action = data.get("action", "toggle")
            if action == "start":
                timer_state.is_running = True
            elif action == "pause":
                timer_state.is_running = False
            elif action == "toggle":
                timer_state.is_running = not timer_state.is_running
            elif action == "add_seconds":
                sec = int(data.get("seconds", 60))
                timer_state.seconds = max(0, min(timer_state.max_seconds, timer_state.seconds + sec))
            elif action == "set_seconds":
                sec = int(data.get("seconds", 3600))
                timer_state.seconds = sec
                timer_state.initial_seconds = sec
            elif action == "set_mode":
                mode = data.get("mode", "countdown")
                timer_state.mode = mode

            payload = {
                "type": "timer_update",
                "seconds": timer_state.seconds,
                "initial_seconds": timer_state.initial_seconds,
                "max_seconds": timer_state.max_seconds,
                "is_running": timer_state.is_running,
                "mode": timer_state.mode,
                "action": action,
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "reset_leaderboard":
            leaderboard_state.reset()
            payload = {
                "type": "leaderboard_update",
                "top_gifters": [],
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type == "auction_control":
            action = data.get("action", "start")
            global auto_dismiss_auction_task
            if action == "start":
                if auto_dismiss_auction_task and not auto_dismiss_auction_task.done():
                    auto_dismiss_auction_task.cancel()
                title = data.get("title", auction_state.title)
                target = int(data.get("target_coins", auction_state.target_coins))
                if data.get("unlimited") or data.get("unlimited_coins") or target <= 0:
                    target = 0
                duration = int(data.get("duration", 300))
                min_inc = int(data.get("min_bid_increment", 1))
                auto_ext = int(data.get("auto_extend_sec", 15))
                auction_state.start(title, target, duration, min_increment=min_inc, auto_extend_sec=auto_ext)
            elif action == "pause":
                auction_state.pause()
            elif action == "resume":
                auction_state.resume()
            elif action == "adjust_time":
                secs = int(data.get("seconds", 30))
                auction_state.adjust_time(secs)
            elif action == "end":
                auction_state.end()
                if auction_state.is_winner_announced:
                    trigger_winner_announcement()
                    winner_payload = {
                        "type": "auction_winner",
                        "winner": auction_state.winner_name,
                        "winning_bid": auction_state.winning_coins,
                        "winner_avatar": auction_state.winner_avatar,
                        "auction": auction_state.to_dict(),
                        "is_mock": True
                    }
                    await broadcast(winner_payload)
                    return web.json_response({"ok": True, "broadcast": winner_payload})
            elif action in ["dismiss_winner", "hide"]:
                if auto_dismiss_auction_task and not auto_dismiss_auction_task.done():
                    auto_dismiss_auction_task.cancel()
                auction_state.dismiss_winner()
                payload = {
                    "type": "auction_dismiss_winner",
                    "auction": auction_state.to_dict(),
                    "is_mock": True
                }
                await broadcast(payload)
                return web.json_response({"ok": True, "broadcast": payload})
            elif action == "reset":
                if auto_dismiss_auction_task and not auto_dismiss_auction_task.done():
                    auto_dismiss_auction_task.cancel()
                auction_state.reset()

            payload = {
                "type": "auction_update",
                "auction": auction_state.to_dict(),
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        # Feature 6 CS:GO Style Gacha Reel Spin Trigger
        elif event_type == "spin_gacha_reel":
            cfg = load_config()
            gacha_cfg = cfg.get("gacha_config", {})
            items_list = data.get("items")
            items_str = data.get("items_str")
            if items_list and isinstance(items_list, list):
                pool_items = items_list
            elif items_str:
                pool_items = [x.strip() for x in items_str.split(",") if x.strip()]
            else:
                pool_items = gacha_cfg.get("items", ["+30", "+15", "+60", "+300", "-30", "-60", "+10", "-15", "+45", "-10"])

            duration = int(data.get("duration", gacha_cfg.get("spin_duration", 5)))
            sender = data.get("sender", "Supporter_VIP")
            sender_avatar = data.get("sender_avatar", data.get("profile_picture", ""))
            trigger_gift = data.get("trigger_gift", gacha_cfg.get("trigger_gift_name", "Doughnut"))
            trigger_gift_icon = data.get("trigger_gift_icon", get_real_gift_icon(trigger_gift) or f"/api/gift-icon?name={urllib.parse.quote(trigger_gift)}")

            winner_item = random.choice(pool_items)
            reel_sequence, winner_index = generate_gacha_reel_sequence(pool_items, winner_item, reel_length=50)

            # Auto Apply to Subathon Timer if item is time delta
            sec_delta = parse_time_delta_seconds(winner_item)
            winner_label = winner_item.get("text", "") if isinstance(winner_item, dict) else str(winner_item)
            if sec_delta is not None:
                max_cap = timer_state.max_seconds or 86400
                if timer_state.mode == "countdown":
                    timer_state.seconds = max(0, min(max_cap, timer_state.seconds + sec_delta))
                else:
                    timer_state.seconds = max(0, min(max_cap, timer_state.seconds - sec_delta))
                log_entry = timer_state.record_change(
                    sender,
                    f"[GACHA] CS:GO Gacha ({winner_label})",
                    1,
                    sec_delta,
                    timer_state.seconds,
                    trigger_gift_icon
                )
                log.info("[GACHA] Manual Gacha Spin result '%s': delta=%ds, new_timer=%ds", winner_label, sec_delta, timer_state.seconds)
                await broadcast({
                    "type": "timer_update",
                    "seconds": timer_state.seconds,
                    "is_running": timer_state.is_running,
                    "mode": timer_state.mode,
                    "initial_seconds": timer_state.initial_seconds,
                    "max_seconds": timer_state.max_seconds,
                    "added_seconds": sec_delta,
                    "timer_stats": timer_state.get_stats(),
                    "log_entry": log_entry
                })

            # Save Config if updated
            if items_str or items_list or "scale" in data or "tick_sound_enabled" in data:
                if "gacha_config" not in cfg:
                    cfg["gacha_config"] = {}
                if items_list and isinstance(items_list, list):
                    cfg["gacha_config"]["items"] = pool_items
                elif items_str:
                    cfg["gacha_config"]["items"] = pool_items
                if "rarity_names" in data and isinstance(data["rarity_names"], dict):
                    cfg["gacha_config"]["rarity_names"] = data["rarity_names"]
                if "duration" in data:
                    cfg["gacha_config"]["spin_duration"] = duration
                if "scale" in data:
                    cfg["gacha_config"]["scale"] = float(data["scale"])
                if "tick_sound_enabled" in data:
                    cfg["gacha_config"]["tick_sound_enabled"] = bool(data["tick_sound_enabled"])
                if "win_sound_enabled" in data:
                    cfg["gacha_config"]["win_sound_enabled"] = bool(data["win_sound_enabled"])
                if "auto_hide" in data:
                    cfg["gacha_config"]["auto_hide"] = bool(data["auto_hide"])
                save_config(cfg)
                gacha_cfg = cfg["gacha_config"]

            payload = {
                "type": "gacha_spin",
                "winner_item": winner_item,
                "reel_sequence": reel_sequence,
                "winner_index": winner_index,
                "duration": duration,
                "timer_seconds": timer_state.seconds,
                "sender": sender,
                "sender_avatar": sender_avatar,
                "trigger_gift": trigger_gift,
                "trigger_gift_icon": trigger_gift_icon,
                "time_delta_seconds": sec_delta,
                "config": gacha_cfg,
                "is_mock": True
            }
            won_gift = resolve_gacha_gift_reward(winner_item, cfg)
            if won_gift:
                payload["won_gift"] = won_gift
                asyncio.create_task(schedule_gacha_gift_drop(duration, won_gift, sender, sender_avatar, cfg))
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        # Feature 7 Visual Effects & Celebration Triggers
        elif event_type == "trigger_vfx":
            vfx_type = data.get("vfx_type", "confetti")
            payload = {
                "type": "vfx_event",
                "vfx_type": vfx_type,
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        elif event_type in ["stop_audio", "stop_media", "stop_video"]:
            payload = {
                "type": "stop_audio",
                "is_mock": True
            }
            await broadcast(payload)
            return web.json_response({"ok": True, "broadcast": payload})

        return web.json_response({"ok": False, "error": f"Unknown event type: {event_type}"}, status=400)

    except Exception as e:
        log.error("Error processing mock event: %s", e)
        return web.json_response({"ok": False, "error": str(e)}, status=500)

async def handle_ws(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    ws_clients.add(ws)

    cfg = load_config()
    top_cnt = int(cfg.get("leaderboard_config", {}).get("top_count", 5))

    await ws.send_str(json.dumps({
        "type": "init",
        "message": "Connected to Studio WebSocket Server",
        "config": cfg,
        "jar_count": jar_state.item_count,
        "timer_seconds": timer_state.seconds,
        "timer_initial_seconds": timer_state.initial_seconds,
        "timer_max_seconds": timer_state.max_seconds,
        "timer_running": timer_state.is_running,
        "timer_mode": timer_state.mode,
        "timer_stats": timer_state.get_stats(),
        "top_gifters": leaderboard_state.get_top(top_cnt),
        "auction": auction_state.to_dict()
    }, ensure_ascii=False))

    try:
        async for msg in ws:
            if msg.type == WSMsgType.ERROR:
                break
    finally:
        ws_clients.discard(ws)
    return ws

active_tiktok_process = None
tiktok_connection_state = {
    "status": "disconnected",
    "username": "",
    "room_id": None,
    "error": None,
    "stats": {"chat_count": 0, "gift_count": 0, "like_count": 0}
}

async def spawn_tiktok_process(username: str):
    global active_tiktok_process
    if active_tiktok_process and active_tiktok_process.returncode is None:
        try:
            active_tiktok_process.terminate()
        except Exception:
            pass

    log.info("Spawning tiktok_connector.js for @%s...", username)
    embedded_node = BASE_DIR / "python_embed" / "node.exe"
    node_cmd = str(embedded_node) if embedded_node.exists() else "node"

    proc = await asyncio.create_subprocess_exec(
        node_cmd, "tiktok_connector.js", username,
        cwd=str(BASE_DIR),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    active_tiktok_process = proc

    async def pipe_reader(stream, prefix):
        try:
            while not stream.at_eof():
                line = await stream.readline()
                if line:
                    decoded = line.decode("utf-8", errors="replace").strip()
                    log.info("[%s] %s", prefix, decoded)
                    if decoded:
                        await broadcast({"type": "tiktok_console_log", "prefix": prefix, "text": decoded})
        except Exception:
            pass

    asyncio.create_task(pipe_reader(proc.stdout, "TikTokLive-Out"))
    asyncio.create_task(pipe_reader(proc.stderr, "TikTokLive-Err"))
    return proc

async def auto_connect_tiktok_task(username: str):
    await asyncio.sleep(1)
    global tiktok_connection_state
    try:
        tiktok_connection_state["username"] = username
        tiktok_connection_state["status"] = "connecting"
        tiktok_connection_state["error"] = None
        tiktok_connection_state["room_id"] = None
        tiktok_connection_state["stats"] = {"chat_count": 0, "gift_count": 0, "like_count": 0}
        await spawn_tiktok_process(username)
        await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
    except Exception as e:
        log.error("Auto-connect failed: %s", e)
        tiktok_connection_state["status"] = "error"
        tiktok_connection_state["error"] = str(e)

async def sync_live_tiktok_gifts_task():
    url = "https://webcast.tiktok.com/webcast/gift/list/?aid=1988&type=1&device_platform=web"
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/"
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=req_headers, ssl=False, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    raw_data = await resp.json()
                    raw_gifts = raw_data.get("data", {}).get("gifts", [])
                    if raw_gifts:
                        clean_gifts = []
                        seen_ids = set()
                        for g in raw_gifts:
                            g_id = g.get("id")
                            g_name = g.get("name", "").strip()
                            if not g_name or g_id in seen_ids:
                                continue
                            seen_ids.add(g_id)
                            img_obj = g.get("icon") or g.get("image") or {}
                            urls = img_obj.get("url_list", [])
                            icon_url = urls[0] if urls else ""
                            clean_gifts.append({
                                "id": g_id,
                                "name": g_name,
                                "coins": g.get("diamond_count", 1),
                                "icon": icon_url
                            })
                        # Only overwrite cache if fetched list is at least 300 gifts to prevent accidental wipes
                        if len(clean_gifts) >= 300:
                            with open(GIFT_CACHE_PATH, "w", encoding="utf-8") as f:
                                json.dump({"gifts": clean_gifts}, f, ensure_ascii=False, indent=2)
                            load_gift_cache()
                            log.info("[TIKTOK] Live gift sync completed: %d gifts indexed from official TikTok API", len(clean_gifts))
                        else:
                            log.info("[TIKTOK] Live gift sync returned %d gifts (kept %d bundled gifts)", len(clean_gifts), len(GIFT_CATALOG_LIST))
    except Exception as e:
        log.warning("Live TikTok gift catalog sync skipped: %s", e)

async def start_background_tasks(app):
    app["timer_task"] = asyncio.create_task(timer_background_task())
    asyncio.create_task(sync_live_tiktok_gifts_task())
    cfg = load_config()
    if cfg.get("auto_connect", False) and cfg.get("tiktok_username"):
        u = cfg["tiktok_username"].strip()
        log.info("Auto-connecting to TikTok LIVE for @%s on app launch...", u)
        asyncio.create_task(auto_connect_tiktok_task(u))

async def cleanup_background_tasks(app):
    global active_tiktok_process
    if active_tiktok_process and active_tiktok_process.returncode is None:
        try:
            active_tiktok_process.terminate()
        except Exception:
            pass
    app["timer_task"].cancel()
    try:
        await app["timer_task"]
    except asyncio.CancelledError:
        pass

async def handle_connect_tiktok(request: web.Request) -> web.Response:
    global tiktok_connection_state
    try:
        data = await request.json()
        username = data.get("username", "").strip().lstrip("@")
        auto_connect = bool(data.get("auto_connect", False))

        if not username:
            return web.json_response({"ok": False, "error": "Username required"}, status=400)

        cfg = load_config()
        cfg["tiktok_username"] = username
        cfg["auto_connect"] = auto_connect
        history = cfg.get("username_history", [])
        if username not in history:
            history.insert(0, username)
            cfg["username_history"] = history[:10]
        save_config(cfg)

        tiktok_connection_state["username"] = username
        tiktok_connection_state["status"] = "connecting"
        tiktok_connection_state["error"] = None
        tiktok_connection_state["room_id"] = None
        tiktok_connection_state["stats"] = {"chat_count": 0, "gift_count": 0, "like_count": 0}

        log.info("Connecting to real TikTok LIVE for @%s...", username)
        await spawn_tiktok_process(username)
        await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
        await broadcast({"type": "refresh_overlays"})
        return web.json_response({
            "ok": True,
            "message": f"Connecting to TikTok LIVE (@{username})...",
            "username": username,
            "connection": tiktok_connection_state
        })
    except Exception as e:
        log.error("Failed to start zerodytrash TikTok connector: %s", e)
        tiktok_connection_state["status"] = "error"
        tiktok_connection_state["error"] = str(e)
        await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
        return web.json_response({"ok": False, "error": str(e)}, status=500)

async def handle_disconnect_tiktok(request: web.Request) -> web.Response:
    global active_tiktok_process, tiktok_connection_state
    if active_tiktok_process and active_tiktok_process.returncode is None:
        try:
            active_tiktok_process.terminate()
        except Exception:
            pass
    active_tiktok_process = None
    tiktok_connection_state["status"] = "disconnected"
    tiktok_connection_state["room_id"] = None
    await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
    return web.json_response({"ok": True, "connection": tiktok_connection_state})

async def handle_tiktok_event(request: web.Request) -> web.Response:
    global tiktok_connection_state
    try:
        data = await request.json()
        event_type = data.get("event_type")

        if event_type == "live_connected":
            tiktok_connection_state["status"] = "connected"
            tiktok_connection_state["room_id"] = data.get("roomId")
            await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
            await broadcast({"type": "refresh_overlays"})
            return web.json_response({"ok": True})

        elif event_type == "live_error":
            tiktok_connection_state["status"] = "error"
            tiktok_connection_state["error"] = data.get("error")
            await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
            return web.json_response({"ok": True})

        elif event_type == "waiting_for_live":
            tiktok_connection_state["status"] = "waiting_for_live"
            tiktok_connection_state["message"] = data.get("message", "รอสตรีมเมอร์เปิดไลฟ์สดบน TikTok...")
            await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
            return web.json_response({"ok": True})

        elif event_type == "stream_end":
            tiktok_connection_state["status"] = "stream_end"
            await broadcast({"type": "tiktok_status_update", "connection": tiktok_connection_state})
            return web.json_response({"ok": True})

        elif event_type == "chat":
            tiktok_connection_state["stats"]["chat_count"] += 1
            return await handle_mock_event(request)

        elif event_type == "gift":
            tiktok_connection_state["stats"]["gift_count"] += 1
            return await handle_mock_event(request)

        elif event_type == "like":
            tiktok_connection_state["stats"]["like_count"] += 1
            await broadcast(data)
            return web.json_response({"ok": True})

        else:
            await broadcast(data)
            return web.json_response({"ok": True, "broadcast": data})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)

async def handle_get_gift_catalog(request: web.Request) -> web.Response:
    if GIFT_CACHE_PATH.exists():
        with open(GIFT_CACHE_PATH, "r", encoding="utf-8") as f:
            return web.Response(text=f.read(), content_type="application/json", headers={"Access-Control-Allow-Origin": "*"})
    return web.json_response({"gifts": []})

async def handle_tiktok_status(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "connection": tiktok_connection_state})

def build_app() -> web.Application:
    app = web.Application()
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    app.router.add_get("/", handle_dashboard)
    app.router.add_get("/dashboard.html", handle_dashboard)
    app.router.add_get("/overlay.html", handle_overlay)
    
    # TikTok LIVE Studio Compatible .html Routes
    app.router.add_get("/overlay_jar.html", handle_overlay_jar)
    app.router.add_get("/overlay_timer.html", handle_overlay_timer)
    app.router.add_get("/overlay_leaderboard.html", handle_overlay_leaderboard)
    app.router.add_get("/overlay_tts.html", handle_overlay_tts)
    app.router.add_get("/overlay_auction.html", handle_overlay_auction)
    app.router.add_get("/overlay_gacha.html", handle_overlay_gacha)
    app.router.add_get("/overlay_vfx.html", handle_overlay_vfx)
    app.router.add_get("/overlay_video.html", handle_overlay_video)

    app.router.add_get("/overlay/jar", handle_overlay_jar)
    app.router.add_get("/overlay/timer", handle_overlay_timer)
    app.router.add_get("/overlay/leaderboard", handle_overlay_leaderboard)
    app.router.add_get("/overlay/tts", handle_overlay_tts)
    app.router.add_get("/overlay/auction", handle_overlay_auction)
    app.router.add_get("/overlay/gacha", handle_overlay_gacha)
    app.router.add_get("/overlay/vfx", handle_overlay_vfx)
    app.router.add_get("/overlay/video", handle_overlay_video)

    app.router.add_get("/api/gift-catalog", handle_get_gift_catalog)
    app.router.add_post("/api/connect-tiktok", handle_connect_tiktok)
    app.router.add_post("/api/disconnect-tiktok", handle_disconnect_tiktok)
    app.router.add_get("/api/tiktok-status", handle_tiktok_status)
    app.router.add_post("/api/tiktok-event", handle_tiktok_event)
    app.router.add_get("/ws", handle_ws)
    app.router.add_get("/api/config", handle_get_config)
    app.router.add_post("/api/config", handle_post_config)
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/timer-history", handle_get_timer_history)
    app.router.add_post("/api/timer-history/clear", handle_clear_timer_history)
    app.router.add_get("/api/sounds", handle_list_sounds)
    app.router.add_get("/api/videos", handle_list_videos)
    app.router.add_get("/api/gift-icon", handle_gift_icon_proxy)
    app.router.add_get("/api/avatar-proxy", handle_avatar_proxy)
    app.router.add_get("/api/tiktok-coin", handle_tiktok_coin)
    app.router.add_post("/api/upload-sound", handle_upload_sound)
    app.router.add_delete("/api/delete-sound", handle_delete_sound)
    app.router.add_post("/api/upload-video", handle_upload_video)
    app.router.add_delete("/api/delete-video", handle_delete_video)
    app.router.add_get("/api/tts", handle_tts_audio)
    app.router.add_post("/api/mock-event", handle_mock_event)
    app.router.add_static("/media/", path=MEDIA_DIR, show_index=False)
    app.router.add_static("/soundeffect/", path=SOUNDEFFECT_DIR, show_index=False)
    return app

if __name__ == "__main__":
    port = 8765
    log.info("Starting Server with Feature 7 (Visual Effects & Celebration) on http://localhost:%d", port)
    web.run_app(build_app(), host="localhost", port=port, print=None)
