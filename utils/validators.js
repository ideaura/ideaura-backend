function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

function validateTopicName(name) {
  return name && name.trim().length > 0 && name.length <= 50;
}

function validateTopicDescription(description) {
  return !description || description.length <= 200;
}

module.exports = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateTopicName,
  validateTopicDescription
};