"""Exercise the operator tool with mocked Supabase requests; never reset live accounts."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "manual_reset", Path(__file__).resolve().parents[1] / "scripts/manual-password-reset.py")
reset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reset)


class ManualResetTests(unittest.TestCase):
    def test_account_lookup_handles_pages_and_preserves_existing_id(self):
        first = {"users": [{"id": str(i), "email": "other@example.test"} for i in range(100)]}
        target = {"id": "existing-user", "email": "Owner@example.test"}
        with patch.object(reset, "request_json", side_effect=[first, {"users": [target]}]) as request:
            self.assertEqual(reset.find_user("https://test.supabase.co", "private", "owner@example.test"), target)
            self.assertIn("page=2", request.call_args.args[0])

    def test_missing_or_ambiguous_account_cannot_be_reset(self):
        for users in [[], [{"email": "owner@example.test"}] * 2]:
            with patch.object(reset, "request_json", return_value={"users": users}):
                with self.assertRaises(RuntimeError):
                    reset.find_user("https://test.supabase.co", "private", "owner@example.test")

    def test_update_changes_only_password_for_selected_account(self):
        with patch.object(reset, "request_json", return_value={"id": "existing-user"}) as request:
            reset.reset_password("https://test.supabase.co", "private", "existing-user", "test-password")
            self.assertEqual(request.call_args.args, (
                "https://test.supabase.co/auth/v1/admin/users/existing-user",
                "private", "PUT", {"password": "test-password"}))

    def test_short_password_never_sends_update(self):
        with patch.object(reset, "request_json") as request:
            with self.assertRaises(RuntimeError):
                reset.reset_password("https://test.supabase.co", "private", "existing-user", "short")
            request.assert_not_called()

    def test_wrong_response_is_not_reported_as_success(self):
        with patch.object(reset, "request_json", return_value={"id": "another-user"}):
            with self.assertRaises(RuntimeError):
                reset.reset_password("https://test.supabase.co", "private", "existing-user", "test-password")


if __name__ == "__main__":
    unittest.main()
