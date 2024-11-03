export const  hasOnlyHindiCharacters=(str: string): boolean => {
    // Define the range for Hindi characters
    const hindiCharRange = /^[\u0900-\u097F]+$/; // This regex matches all Hindi characters in the Unicode range

    return hindiCharRange.test(str);
}