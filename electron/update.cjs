function isNewerVersion(latest, current) {
  const left = String(latest).replace(/^v/, '').split('.').map(Number);
  const right = String(current).replace(/^v/, '').split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return false;
}

module.exports = { isNewerVersion };
