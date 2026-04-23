const formatPart = (value) => String(value).padStart(2, "0");

export const getCurrentTimestampName = (date = new Date()) => {
    const year = date.getFullYear();
    const month = formatPart(date.getMonth() + 1);
    const day = formatPart(date.getDate());
    const hours = formatPart(date.getHours());
    const minutes = formatPart(date.getMinutes());

    return `${year}-${month}-${day} ${hours}:${minutes}`;
};
