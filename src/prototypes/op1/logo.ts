// The Wikipedia globe as a pixel puzzle, one character per screen pixel:
// o light piece, m mid-grey (the piece seen through the hole), d dark grey,
// # seam (left black on the screen), . nothing. The pieces are found by
// flood-filling between the seams, so each one can move on its own.

const ROWS = [
  '............................##........##.............',
  '...........................#oo#......#oo#m...........',
  '...........##..............#oo#.....#oooo##..........',
  '..........#o#..........####oooo#####ooooooo#.........',
  '.........#oo#.........#oooooooooooo#oooooooo#........',
  '........#oo#..........#oooooo#oooooo##ooooooo#.......',
  '.......##o#...........doooo##o##oooooo#ooooooo#......',
  '......#oo#.............##oo#ooo#oooooo#oooooo#o#.....',
  '.....m#oo#...............#oooo#oo#ooo#oooooodoo#m....',
  '.....#o#ood#....mm.......#ooo#oo##oo#ooooooo#ooo#....',
  '....#oo#oooo#..mmmm....##ooo#oooo#oo#oo##ooo#oooo#...',
  '....####oooo#..mmmm...#oooooooooooooo##oo#oo#oooo#...',
  '...#ooo#oo##mmmmmmmmmm#oooooo##oooooo#oooo##oooooo#..',
  '...#ooooo#mmmmmmmmmmmmm#oooodoo#oo####ooooooo##ooo#..',
  '...#ooooo#mmmmmmmmmmmmm#oooo#ooo##oooo#oooooo#o#oo#m.',
  '..#oo########mmmmmm#########oooooooooo#ooo#oo#o#ooo#.',
  '..###oo#ooooo#mmmm#oooo#ooooooooooooooo#oo#ooo##ooo#.',
  '..#oooo#ooooo#mmmm#oooo#oo#oo#o#oo#oooo#ooo#oo##ooo#.',
  '.#ooooo#oooooo####ooooo#oo#oo#o#oo#oo##ooooo###oooo##',
  '.#ooooo#oooooooooooooo#oooo#oo#oo#oo#ooooooooooooooo#',
  '.#ooo##oooooo####oooo#ooooo#o#o#o#oo#oooooooo##ooooo#',
  '.#oo#ooooooo#oooo#ooo#oooooo#mom#oooo##ooooo#oo#oo###',
  '.#oo#ooooooo#oooo#ooo#oooooo#ooo#oooooo#oooo#ooo##oo#',
  '.#ooo##ooooo#oooo#oooo##ooooooooooooooo#oo##oooooooo#',
  '.#ooooo#ooooo#oo#ooooooo#ooooo####ooooo###oooooooooo#',
  '.#ooooo#ooo###oo###ooooo#oooo#ooo#ooo###oooom#mo#ooo#',
  '.#ooooo#oooooooooooooooo#oooo#oooo###oo#oooo#o#o#ooo#',
  '.#############ooooo#######ooo#ooooooooo#oooom#mo#ooo#',
  '..#oooo#oooooo#ooo#oooooo####ooooooo#oo#oooooooo#oo#.',
  '..#oooo#oooooo#ooo#oooooo#ooooo#ooo##ooo##oo###m#oo#.',
  '..#oooo#ooooooo#d#ooo#ooo#ooooo#oo#m#ooooo#oo#oo#oo#.',
  '..#oooo#ooooooo#oooo#oooo#ooooo#mo#om#oooo#oo#oo#o#m.',
  '...#oooo###ooo#o#oo#oo#ooo##doom##ooo#oo##oooooo#o#..',
  '...#ooooooo#ooo#ooo####oooooo#oo#oooo#oo#ooooooooo#..',
  '....#oooooo#oo#o#oo#o#ooooooo#oo#ooooooo#oooooooo#...',
  '....#oooo##ooo###oo#d##oooo##ooooo###ooo#ooooo##d#...',
  '.....#oo#oooooo#ooo#o#oooo#oooooo#ooo#ooo#oo##oo#....',
  '.....m#o#oooo#o#o#o####ooo#oooooomooo#ooo###ooo#m....',
  '......#o#oooooooooooooooo#####d##ooooo####ooooo#.....',
  '.......#########ooooo####oooo#ooooooooooo#oooo#......',
  '........#oo#oooo#ooo#oooooooo#oooo###oooo#ooo#.......',
  '.........#o#oooo#ooo#oooooooo#oooooo#ooooo#o#........',
  '..........##ooooo###ooooooo##ooooooo#oooood#.........',
  '...........##oooooooo###oo#oooooooo#ooooo##..........',
  '.............#ooooooooo#oo#oooooooo#oooo#............',
  '..............##oooo####ooo##ooooooooo##.............',
  '................###oooooooooo#ooooo###...............',
  '...................###ooooooo#oo###..................',
  '......................##########.....................',
  '.....................................................',
]

const GREY: Record<string, number> = { o: 224, m: 128, d: 72 }

export type Piece = {
  /** Pixels as [x, y, grey], x and y from the globe's centre. */
  pixels: [number, number, number][]
  /** Centre of the piece, across, from the globe's centre. */
  cx: number
  /** A fixed 0–1 number per piece, so each moves a little differently. */
  seed: number
}

export const GLOBE_W = ROWS[0].length
export const GLOBE_H = ROWS.length

export const PIECES: Piece[] = (() => {
  const at = (x: number, y: number) => ROWS[y]?.[x] ?? "."
  const kind = (c: string) => (c === "o" ? "o" : c === "m" || c === "d" ? "m" : null)
  const owner: number[][] = ROWS.map((r) => Array(r.length).fill(-1))
  const groups: [number, number][][] = []
  for (let y = 0; y < GLOBE_H; y++)
    for (let x = 0; x < GLOBE_W; x++) {
      const k = kind(at(x, y))
      if (!k || owner[y][x] >= 0) continue
      const id = groups.length
      const cells: [number, number][] = []
      const stack: [number, number][] = [[x, y]]
      owner[y][x] = id
      while (stack.length) {
        const [px, py] = stack.pop()!
        cells.push([px, py])
        for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
          if (owner[ny]?.[nx] === -1 && kind(at(nx, ny)) === k) {
            owner[ny][nx] = id
            stack.push([nx, ny])
          }
        }
      }
      groups.push(cells)
    }
  // Stray specks (a pixel or two of grey along a seam) join the biggest piece they touch.
  const merged = groups.map((g) => g)
  groups.forEach((cells, id) => {
    if (cells.length > 3) return
    let best = -1
    cells.forEach(([x, y]) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const o = owner[y + dy]?.[x + dx] ?? -1
          if (o >= 0 && o !== id && groups[o].length > 3 && (best < 0 || groups[o].length > groups[best].length)) best = o
        }
    })
    if (best >= 0) {
      merged[best] = merged[best].concat(cells)
      merged[id] = []
    }
  })
  const ox = (GLOBE_W - 1) / 2
  const oy = (GLOBE_H - 1) / 2
  return merged
    .filter((cells) => cells.length)
    .map((cells, i) => {
      const cx = cells.reduce((s, [x]) => s + x, 0) / cells.length - ox
      return {
        pixels: cells.map(([x, y]) => [x - ox, y - oy, GREY[at(x, y)]] as [number, number, number]),
        cx,
        seed: ((i * 0.6180339887) % 1 + 1) % 1,
      }
    })
})()
