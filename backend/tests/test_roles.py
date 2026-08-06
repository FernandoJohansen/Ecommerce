"""Role hierarchy — pure logic, no I/O.

role_at_least is the gate used by require_role() on every protected endpoint.
A bug here could silently grant admin or staff access to regular customers.
"""

import os

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-service-role-key-for-unit-tests-only")
os.environ.setdefault("ENVIRONMENT", "development")

from app.core.roles import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, role_at_least


class TestRoleAtLeast:
    # ── Customer checks ──────────────────────────────────────────────────────
    def test_customer_satisfies_customer(self):
        assert role_at_least(ROLE_CUSTOMER, ROLE_CUSTOMER) is True

    def test_customer_does_not_satisfy_staff(self):
        assert role_at_least(ROLE_CUSTOMER, ROLE_STAFF) is False

    def test_customer_does_not_satisfy_admin(self):
        assert role_at_least(ROLE_CUSTOMER, ROLE_ADMIN) is False

    # ── Staff checks ─────────────────────────────────────────────────────────
    def test_staff_satisfies_customer(self):
        assert role_at_least(ROLE_STAFF, ROLE_CUSTOMER) is True

    def test_staff_satisfies_staff(self):
        assert role_at_least(ROLE_STAFF, ROLE_STAFF) is True

    def test_staff_does_not_satisfy_admin(self):
        assert role_at_least(ROLE_STAFF, ROLE_ADMIN) is False

    # ── Admin checks ─────────────────────────────────────────────────────────
    def test_admin_satisfies_customer(self):
        assert role_at_least(ROLE_ADMIN, ROLE_CUSTOMER) is True

    def test_admin_satisfies_staff(self):
        assert role_at_least(ROLE_ADMIN, ROLE_STAFF) is True

    def test_admin_satisfies_admin(self):
        assert role_at_least(ROLE_ADMIN, ROLE_ADMIN) is True

    # ── Unknown role is never privileged ────────────────────────────────────
    def test_unknown_role_does_not_satisfy_customer(self):
        assert role_at_least("superuser", ROLE_CUSTOMER) is False

    def test_unknown_role_does_not_satisfy_staff(self):
        assert role_at_least("superuser", ROLE_STAFF) is False

    def test_unknown_role_does_not_satisfy_admin(self):
        assert role_at_least("superuser", ROLE_ADMIN) is False

    def test_empty_string_role_is_not_privileged(self):
        assert role_at_least("", ROLE_CUSTOMER) is False
