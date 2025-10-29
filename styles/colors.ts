export interface ColorPalette {
  name: string;
  highlight: string;
  base: string;
  bg: string;
}

export const lyricColorPalettes: ColorPalette[] = [
  { name: '經典白', highlight: '#FFFFFF', base: '#a3a3a3', bg: 'linear-gradient(to right, #FFFFFF, #a3a3a3)' },
  { name: '落日黃昏', highlight: '#FBBF24', base: '#F87171', bg: 'linear-gradient(to right, #FBBF24, #F87171)' },
  { name: '蔚藍海洋', highlight: '#60A5FA', base: '#34D399', bg: 'linear-gradient(to right, #60A5FA, #34D399)' },
  { name: '霓虹光暈', highlight: '#A78BFA', base: '#F472B6', bg: 'linear-gradient(to right, #A78BFA, #F472B6)' },
  { name: '青蔥森林', highlight: '#A3E635', base: '#65A30D', bg: 'linear-gradient(to right, #A3E635, #65A30D)' },
];
