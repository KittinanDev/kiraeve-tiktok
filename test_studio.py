"""
Automated Test Suite for TikTok LIVE Interactive Studio v2.0 (unittest)
======================================================================
Tests core business logic:
- Subathon timer calculation and max cap logic
- Top Gifters leaderboard sorting and rank assignment
- TTS Chat text cleaning and bad word filtering
- Coin Match Auction bid validation
- Deep config merge and load/save functions
"""

import unittest
from server import (
    calculate_subathon_addition,
    update_top_gifters_list,
    filter_tts_text,
    process_auction_bid,
    deep_merge,
    DEFAULT_CONFIG
)

class TestTikTokStudio(unittest.TestCase):

    # ---------------------------------------------------------------------------
    # 1. Subathon Timer Tests
    # ---------------------------------------------------------------------------
    def test_subathon_timer_addition(self):
        result = calculate_subathon_addition(coins=100, seconds_per_coin=2.0, current=1000.0, max_seconds=86400.0)
        self.assertEqual(result, 1200.0)

    def test_subathon_timer_max_cap(self):
        result = calculate_subathon_addition(coins=50000, seconds_per_coin=2.0, current=80000.0, max_seconds=86400.0)
        self.assertEqual(result, 86400.0)

    # ---------------------------------------------------------------------------
    # 2. Leaderboard Tests
    # ---------------------------------------------------------------------------
    def test_leaderboard_sorting_and_ranks(self):
        gifters = {}

        list_1 = update_top_gifters_list(gifters, sender="UserA", coins=100)
        self.assertEqual(list_1[0]["name"], "UserA")
        self.assertEqual(list_1[0]["rank"], 1)
        self.assertEqual(list_1[0]["total_coins"], 100)

        list_2 = update_top_gifters_list(gifters, sender="UserB", coins=500)
        self.assertEqual(list_2[0]["name"], "UserB")
        self.assertEqual(list_2[0]["rank"], 1)
        self.assertEqual(list_2[0]["total_coins"], 500)
        self.assertEqual(list_2[1]["name"], "UserA")
        self.assertEqual(list_2[1]["rank"], 2)

        list_3 = update_top_gifters_list(gifters, sender="UserA", coins=1000)
        self.assertEqual(list_3[0]["name"], "UserA")
        self.assertEqual(list_3[0]["total_coins"], 1100)

    # ---------------------------------------------------------------------------
    # 3. TTS Filter Tests
    # ---------------------------------------------------------------------------
    def test_tts_bad_words_filtering(self):
        blacklisted = ["badword", "คำหยาบ"]
        raw_text = "สวัสดีครับ badword และ คำหยาบ สบายดีไหม"
        filtered = filter_tts_text(raw_text, blacklisted_words=blacklisted)
        self.assertIn("***", filtered)
        self.assertNotIn("badword", filtered)
        self.assertNotIn("คำหยาบ", filtered)

    def test_tts_max_length_truncation(self):
        long_text = "A" * 150
        filtered = filter_tts_text(long_text, blacklisted_words=[], max_length=50)
        self.assertEqual(len(filtered), 53)  # 50 chars + "..."
        self.assertTrue(filtered.endswith("..."))

    # ---------------------------------------------------------------------------
    # 4. Auction Logic Tests
    # ---------------------------------------------------------------------------
    def test_auction_bidding(self):
        auction = {
            "is_active": True,
            "min_coins": 10,
            "highest_coins": 0,
            "highest_bidder": None
        }

        self.assertFalse(process_auction_bid(auction, sender="UserX", coins=5))
        self.assertIsNone(auction["highest_bidder"])

        self.assertTrue(process_auction_bid(auction, sender="UserX", coins=50))
        self.assertEqual(auction["highest_bidder"], "UserX")
        self.assertEqual(auction["highest_coins"], 50)

        self.assertFalse(process_auction_bid(auction, sender="UserY", coins=40))
        self.assertEqual(auction["highest_bidder"], "UserX")

        self.assertTrue(process_auction_bid(auction, sender="UserY", coins=100))
        self.assertEqual(auction["highest_bidder"], "UserY")
        self.assertEqual(auction["highest_coins"], 100)

    # ---------------------------------------------------------------------------
    # 5. Config Deep Merge Test
    # ---------------------------------------------------------------------------
    def test_deep_merge_config(self):
        custom = {
            "subathon_config": {
                "seconds_per_coin": 5.0
            }
        }
        merged = deep_merge(DEFAULT_CONFIG, custom)
        self.assertEqual(merged["subathon_config"]["seconds_per_coin"], 5.0)
        self.assertEqual(merged["subathon_config"]["base_seconds"], 3600)

if __name__ == "__main__":
    unittest.main()
