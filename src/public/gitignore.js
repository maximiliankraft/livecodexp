/**
 * Checks if a file path is ignored according to gitignore patterns
 * @param {File} gitignoreFile - Path to the .gitignore file
 * @param {string} gitignoreDir - Directory of the .gitignore file
 * @param {string} filePath - Path of the file to check
 * @returns {Promise<boolean>} Returns true if the file is ignored, false otherwise
 */
async function isIgnoredByGitignore(gitignoreFile, gitignoreDir, filePath) {
  if (!gitignoreFile || !filePath) {
    return false; // If no gitignore file or file path is provided, return false
  }

  const gitignoreContent = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(gitignoreFile);
  });

  const normalizedFilePath = gitignoreDir
    ? filePath.replace(new RegExp(`^${gitignoreDir}/?`), '')
    : filePath;

  const filePathForward = normalizedFilePath.split('\\').join('/');

  const patterns = processGitignorePatterns(gitignoreContent);

  return isFileIgnored(filePathForward, patterns);
}

/**
 * Processes gitignore content into a structured format
 * @param {string} gitignoreContent - Content of the gitignore file
 * @returns {Array<{ pattern: string, negate: boolean }>} Array of pattern objects with pattern and negate flag
 */
function processGitignorePatterns(gitignoreContent) {
  const lines = gitignoreContent.split('\n');
  lines.push('.git');

  const patterns = [];

  for (let line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    line = removeUnescapedTrailingSpaces(line);

    if (line.startsWith('\\#')) {
      line = line.substring(1);
    } else if (line.startsWith('\\!')) {
      line = line.substring(1);
    }

    let negate = false;
    if (line.startsWith('!')) {
      negate = true;
      line = line.substring(1);
    }

    patterns.push({
      pattern: line,
      negate: negate,
    });
  }

  return patterns;
}

/**
 * Removes trailing spaces unless they are escaped
 * @param {string} line - Line to process
 * @returns {string} Line with unescaped trailing spaces removed
 */
function removeUnescapedTrailingSpaces(line) {
  let result = '';
  let i = 0;

  while (i < line.length) {
    if (line[i] === '\\' && i + 1 < line.length && line[i + 1] === ' ') {
      result += ' ';
      i += 2;
    } else {
      result += line[i];
      i++;
    }
  }

  return result.replace(/(?<!\\)[ \t]+$/, '');
}

/**
 * Determines if a file is ignored based on gitignore patterns
 * @param {string} filePath - Path of the file to check
 * @param {Array<{ pattern: string, negate: boolean }>} patterns - Processed gitignore patterns
 * @returns {boolean} Returns true if the file is ignored
 */
function isFileIgnored(filePath, patterns) {
  let ignored = false;

  for (const { pattern, negate } of patterns) {
    if (matchesPattern(filePath, pattern)) {
      ignored = !negate;
    }
  }

  return ignored;
}

/**
 * Checks if a file path matches a gitignore pattern
 * @param {string} filePath - Path to check
 * @param {string} pattern - Gitignore pattern
 * @returns {boolean} Returns true if the path matches the pattern
 */
function matchesPattern(filePath, pattern) {
  const regexPattern = convertGitignoreToRegex(pattern);
  return regexPattern.test(filePath);
}

/**
 * Converts a gitignore pattern to a regular expression
 * @param {string} pattern - Gitignore pattern
 * @returns {RegExp} Regular expression for matching paths
 */
function convertGitignoreToRegex(pattern) {
  let regexPattern = '';

  const startsWithSlash = pattern.startsWith('/');
  const endsWithSlash = pattern.endsWith('/');

  if (endsWithSlash) {
    pattern = pattern.slice(0, -1);
  }

  if (pattern.startsWith('**/')) {
    regexPattern = '(?:^|.+/)';
    pattern = pattern.substring(3);
  } else if (startsWithSlash) {
    regexPattern = '^';
    pattern = pattern.substring(1);
  } else {
    regexPattern = '(?:^|.+/)';
  }

  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      if (i + 1 < pattern.length && pattern[i + 1] === '*') {
        if (i + 2 < pattern.length && pattern[i + 2] === '/') {
          regexPattern += '(?:(?:.+/))*/';
          i += 3;
        } else {
          regexPattern += '.*';
          i += 2;
        }
      } else {
        regexPattern += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      regexPattern += '[^/]';
      i++;
    } else if (char === '[') {
      let j = i + 1;
      let charClass = '[';

      while (j < pattern.length && pattern[j] !== ']') {
        charClass += pattern[j];
        j++;
      }

      if (j < pattern.length) {
        charClass += ']';
        regexPattern += charClass;
        i = j + 1;
      } else {
        regexPattern += '\\[';
        i++;
      }
    } else if (char === '/') {
      regexPattern += '/';
      i++;
    } else {
      if ('.+(){}^$\\'.includes(char)) {
        regexPattern += '\\';
      }
      regexPattern += char;
      i++;
    }
  }

  if (pattern.endsWith('/**')) {
    regexPattern = regexPattern.slice(0, -3) + '(?:/.+)?$';
  } else if (endsWithSlash) {
    regexPattern += '(?:/.*)?$';
  } else {
    regexPattern += '$';
  }

  return new RegExp(regexPattern);
}

export default isIgnoredByGitignore;
