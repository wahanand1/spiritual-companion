export const  hasOnlyHindiCharacters=(str: string): boolean => {
    let isHindi = true
    for (let char of str.split(""))
    {
        var charCode = char.match(/[a-zA-Z]/); 
        if(charCode)  
        {
            isHindi=false
            break;
        }
    }
    return isHindi
    
    
}