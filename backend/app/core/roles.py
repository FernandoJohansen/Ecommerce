ROLE_CUSTOMER = "customer"
ROLE_STAFF = "staff"
ROLE_ADMIN = "admin"

# Hierarchical: each role includes the permissions of the ones below it.
ROLE_HIERARCHY: dict[str, int] = {ROLE_CUSTOMER: 0, ROLE_STAFF: 1, ROLE_ADMIN: 2}


def role_at_least(role: str, minimum: str) -> bool:
    return ROLE_HIERARCHY.get(role, -1) >= ROLE_HIERARCHY[minimum]
