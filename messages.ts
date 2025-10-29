export const completionMessages = [
  '麵煮好了！記得先吹涼再感動。',
  '阿嬤聽完點頭說：這碗可以出道。',
  '成功對時，湯濃歌順，人生少一事。',
  '熱音不燙嘴，燙的是回憶。',
  '完成啦～音浪滾燙，小心別噎到副歌。',
  '成功上桌，這碗旋律剛好七分熟。',
  '你又完成了一件值得驕傲的小事。'
];

export const inspirationalMessages = [
    '一首歌，一碗湯，慢火煮出心的味道。',
    '原來人生的節奏，也能對上旋律的沸點。',
    '你的歌詞在冒泡，像是夢想正在滾。',
    '煮完這碗麵，也煮熟了一段心情。',
    '阿嬤說：不趕時間的麵最香，音樂也一樣。',
    '這碗煮好了，下一碗要不要一起？',
    '泡麵會冷，創作不會。',
    '世界太快，但你還願意慢慢煮。'
];

export const getRandomMessage = (messageArray: string[]): string => {
    return messageArray[Math.floor(Math.random() * messageArray.length)];
};
