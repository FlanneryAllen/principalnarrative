/**
 * Test file with intentional violations of organizational intent
 * This should fail validation
 */

// ❌ VIOLATION 1: Using 'any' type (forbidden by operational_typescript_strict_mode)
function processData(data: any) {
  return data;
}

// ❌ VIOLATION 2: Using localStorage (forbidden by healthcare intent units)
function saveToken(token: string) {
  localStorage.setItem('auth_token', token);
  return true;
}

// ❌ VIOLATION 3: Using console.log (forbidden by healthcare intent units)
function debugUser(user: any) {
  console.log('User data:', user);
  return user;
}

// ❌ VIOLATION 4: God object (forbidden by core_story_simplicity_through_structure)
class MegaManager {
  // Violates single_responsibility - does too many things
  handleAuth() {}
  handleDatabase() {}
  handleAPI() {}
  handleUI() {}
  handleCache() {}
  handleLogging() {}
  handleValidation() {}
  handleNotifications() {}
  // ... god object with too many responsibilities
}

// ❌ VIOLATION 5: Using eval (forbidden pattern)
function executeCode(code: string) {
  return eval(code);
}

// ❌ VIOLATION 6: No type annotations (violates strict mode)
function calculate(a, b) {
  return a + b;
}

// ❌ VIOLATION 7: Basic auth (forbidden by healthcare units)
function authenticateBasic(username: string, password: string) {
  const basic_auth = btoa(`${username}:${password}`);
  return basic_auth;
}

export {};
