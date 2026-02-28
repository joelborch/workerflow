type ValidationResult = {
  ok: boolean;
  errors: string[];
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function unwrapBody(payload: unknown) {
  const object = asObject(payload);
  if (object && "body" in object) {
    return object.body;
  }
  return payload;
}

function requireObject(routePath: string, value: unknown, errors: string[]) {
  const object = asObject(value);
  if (!object) {
    errors.push(`${routePath}: payload body must be an object`);
    return null;
  }
  return object;
}

function requireStringField(
  routePath: string,
  object: Record<string, unknown>,
  field: string,
  errors: string[],
  options?: { minLength?: number }
) {
  const raw = object[field];
  if (typeof raw !== "string") {
    errors.push(`${routePath}: "${field}" must be a string`);
    return;
  }

  const minLength = options?.minLength ?? 1;
  if (raw.trim().length < minLength) {
    errors.push(`${routePath}: "${field}" must be at least ${minLength} chars`);
  }
}

function requireNumberField(routePath: string, object: Record<string, unknown>, field: string, errors: string[]) {
  const raw = object[field];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    errors.push(`${routePath}: "${field}" must be a finite number`);
    return;
  }
}

export function validateRoutePayload(routePath: string, requestPayload: unknown): ValidationResult {
  const errors: string[] = [];
  const body = unwrapBody(requestPayload);

  switch (routePath) {
    case "webhook_echo": {
      // intentionally permissive route used for smoke and debug scenarios
      break;
    }
    case "chat_notify":
    case "slack_message": {
      const object = requireObject(routePath, body, errors);
      if (object) {
        requireStringField(routePath, object, "text", errors);
      }
      break;
    }
    case "github_issue_create": {
      const object = requireObject(routePath, body, errors);
      if (object && object.title !== undefined) {
        requireStringField(routePath, object, "title", errors);
      }
      break;
    }
    case "openai_chat": {
      const object = requireObject(routePath, body, errors);
      if (object && object.prompt !== undefined) {
        requireStringField(routePath, object, "prompt", errors);
      }
      break;
    }
    case "stripe_payment_intent_create": {
      const object = requireObject(routePath, body, errors);
      if (object) {
        requireNumberField(routePath, object, "amount", errors);
      }
      break;
    }
    case "stripe_customer_upsert":
    case "hubspot_contact_upsert": {
      const object = requireObject(routePath, body, errors);
      if (object) {
        requireStringField(routePath, object, "email", errors);
      }
      break;
    }
    case "notion_database_item_create": {
      const object = requireObject(routePath, body, errors);
      if (object) {
        requireStringField(routePath, object, "databaseId", errors);
        if (!asObject(object.properties)) {
          errors.push(`${routePath}: "properties" must be an object`);
        }
      }
      break;
    }
    case "notion_database_item_get": {
      const object = requireObject(routePath, body, errors);
      if (object) {
        const pageId = typeof object.pageId === "string" ? object.pageId.trim() : "";
        const idAlias = typeof object.id === "string" ? object.id.trim() : "";
        if (!pageId && !idAlias) {
          errors.push(`${routePath}: requires "pageId" (or "id") string`);
        }
      }
      break;
    }
    case "hubspot_deal_upsert": {
      const object = requireObject(routePath, body, errors);
      if (object) {
        requireStringField(routePath, object, "idProperty", errors);
        requireStringField(routePath, object, "idValue", errors);
      }
      break;
    }
    default:
      break;
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
