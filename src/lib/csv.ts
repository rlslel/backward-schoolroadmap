// 구글 시트가 「웹에 게시」로 내주는 CSV 를 읽는다.
// 외부 라이브러리를 쓰지 않는다. 따옴표로 감싼 칸, 칸 안의 쉼표와 줄바꿈까지 처리한다.

/** CSV 글자를 표(행 × 칸)로 바꾼다. 잘못된 입력이어도 예외를 던지지 않는다. */
export function parseCsv(text: string): string[][] {
  // 엑셀·구글이 붙이는 BOM 을 떼지 않으면 첫 칸 이름이 안 맞는다
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'; // "" 는 따옴표 한 개를 뜻한다
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** 칸이 전부 빈 줄은 버린다. 시트 아래쪽 빈 행이 그대로 딸려 오기 때문이다. */
export function dropEmptyRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}
