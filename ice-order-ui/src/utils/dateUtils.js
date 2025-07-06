// Utility functions for date formatting and manipulation

export const formatDateForInput = (dateValue) => {
    if (!dateValue && dateValue !== 0) { // Handles null, undefined, empty string, but allows 0 for timestamp
        return '';
    }

    try {
        let d;
        // If dateValue is already a YYYY-MM-DD string,
        // parse it carefully to ensure it's treated as local.
        // new Date('YYYY-MM-DD') might interpret it as UTC midnight.
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            const parts = dateValue.split('-');
            // Month is 0-indexed in JS Date constructor (year, monthIndex, day)
            // This explicitly creates a date at local midnight for the given calendar date.
            d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            // Handles JS Date objects, full ISO strings (which include timezone or are UTC),
            // and numeric timestamps.
            d = new Date(dateValue);
        }

        if (isNaN(d.getTime())) { // Check if the parsed date is valid
            console.warn("Invalid dateValue received by formatDateForInput:", dateValue);
            return '';
        }
        // 'en-CA' locale consistently formats to YYYY-MM-DD
        // using the local timezone interpretation of the Date object 'd'.
        return d.toLocaleDateString('en-CA');
    } catch (e) {
        console.error("Error formatting date for input:", dateValue, e);
        return ''; // Return empty string or handle error as appropriate
    }
};

export const getCurrentLocalDateISO = () => {
    return new Date().toLocaleDateString('en-CA');
};

export const getCurrentLocalMonthISO = () => {
    return new Date().toLocaleDateString('en-CA').slice(0, 7); // Returns "YYYY-MM"
};

export const formatDisplayDate = (dateValue, locale = 'th-TH', options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!dateValue && dateValue !== 0) return 'N/A';
    try {
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString(locale, options);
    } catch (e) {
        return 'Invalid Date';
    }
};

export const getISODate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    // Check for invalid date
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
};

/**
 * Gets a local Date object, adjusting for timezone offset to prevent date changes.
 * @param {Date | string} date - The date to convert.
 * @returns {Date} A new Date object representing the local date.
 */
export const getLocalDate = (date) => {
    if (!date) return new Date();
    // Handles both Date objects and ISO strings
    const d = new Date(date);
    // Adjust for timezone offset to prevent date changes
    const timezoneOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - timezoneOffset);
};

/**
 * Formats a date string (like 'YYYY-MM-DD') into a more readable format (DD/MM/YYYY).
 * This function is safe from timezone issues.
 * @param {string} dateString - The date string to format.
 * @returns {string} The formatted date, or the original string if invalid.
 */
export const formatDate = (dateString) => {
  if (!dateString) {
    return ''; // Return empty string for invalid input
  }
  try {
    // Appending 'T00:00:00Z' treats the input as a UTC date, which prevents
    // the user's local timezone from shifting the date.
    const date = new Date(dateString + 'T00:00:00Z');
    
    // Check if the created date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if it's not a valid date
    }

    // Use UTC methods to extract date parts to avoid timezone interference
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // getUTCMonth is 0-indexed
    const year = date.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return dateString; // On error, return the original string
  }
};