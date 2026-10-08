#!/usr/bin/env python3
"""Private operator tool. Never deploy this script or its credentials to the browser."""
import argparse
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def request_json(url, key, method="GET", payload=None):
    request = urllib.request.Request(
        url,
        headers={"Authorization": "Bearer " + key, "apikey": key,
                 "Content-Type": "application/json"},
        method=method,
        data=None if payload is None else json.dumps(payload).encode(),
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Do not echo response bodies, request headers, or credential values.
        raise RuntimeError("Supabase request failed (HTTP %s)." % error.code) from None
    except urllib.error.URLError:
        raise RuntimeError("Could not connect to Supabase. Check network access.") from None


def admin_connection():
    origin = os.environ.get("SUPABASE_URL", "")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    parsed = urllib.parse.urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname
            or not parsed.hostname.endswith(".supabase.co")
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment
            or parsed.username or parsed.password or parsed.port):
        raise RuntimeError("Set SUPABASE_URL to your HTTPS Supabase project origin.")
    if not token:
        raise RuntimeError("Set SUPABASE_ACCESS_TOKEN securely in environment settings.")
    ref = parsed.hostname.split(".")[0]
    keys = request_json("https://api.supabase.com/v1/projects/" + ref + "/api-keys", token)
    key = next((item.get("api_key") for item in keys
                if item.get("name") == "service_role"), None)
    if not key:
        raise RuntimeError("No service-role key available. Check project administrative access.")
    # The retrieved key is held in memory only and sent solely to this project.
    return "https://" + parsed.hostname, key


def find_user(origin, key, email):
    page = 1
    matches = []
    while True:
        data = request_json(origin + "/auth/v1/admin/users?page=%s&per_page=100" % page, key)
        users = data["users"]
        matches.extend(user for user in users if (user.get("email") or "").casefold() == email.casefold())
        if len(users) < 100:
            break
        page += 1
    if len(matches) != 1:
        raise RuntimeError("Expected exactly one existing account for that email. No password changed.")
    return matches[0]


def reset_password(origin, key, user_id, password):
    if len(password) < 8:
        raise RuntimeError("Use a password of at least 8 characters.")
    target = urllib.parse.quote(user_id, safe="")
    result = request_json(origin + "/auth/v1/admin/users/" + target,
                          key, "PUT", {"password": password})
    if result.get("id") != user_id:
        raise RuntimeError("Reset response could not be verified. Check the account before retrying.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify admin access without changing accounts")
    args = parser.parse_args()
    origin, key = admin_connection()
    if args.check:
        request_json(origin + "/auth/v1/admin/users?page=1&per_page=1", key)
        print("Administrative access verified. No accounts changed.")
        return
    email = input("Existing account email: ").strip()
    if not email or "@" not in email:
        raise RuntimeError("Enter the existing account email. No password changed.")
    user = find_user(origin, key, email)
    print("Verify this person's identity through a trusted channel before proceeding.")
    if input("Type the account email again to confirm the reset: ").strip().casefold() != email.casefold():
        raise RuntimeError("Confirmation did not match. No password changed.")
    if not sys.stdin.isatty():
        raise RuntimeError("Run in an interactive terminal so passwords stay hidden.")
    password = getpass.getpass("New password (at least 8 characters): ")
    if password != getpass.getpass("Repeat new password: "):
        raise RuntimeError("Passwords did not match. No password changed.")
    reset_password(origin, key, user["id"], password)
    print("Password updated for the existing account. Readings and account ID were preserved.")
    print("Share the new password privately with the verified account owner.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError, TypeError) as error:
        print("Reset stopped: " + str(error), file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print("Reset cancelled.", file=sys.stderr)
        sys.exit(1)
