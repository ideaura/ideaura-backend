function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  // 用户名可以是任何字符，只需非空即可
  return username && username.trim().length > 0;
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