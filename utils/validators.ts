export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username: string): boolean {
  return username !== undefined && username !== null && username.trim().length > 0;
}

export function validatePassword(password: string): boolean {
  return password !== undefined && password !== null && password.length >= 8;
}

export function validateTopicName(name: string): boolean {
  return name !== undefined && name !== null && name.trim().length > 0 && name.length <= 50;
}

export function validateTopicDescription(description: string): boolean {
  return description === undefined || description === null || description.length <= 200;
}
