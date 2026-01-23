export class Renderer {
    constructor(buffer, containerId) {
        this.buffer = buffer;
        this.container = document.getElementById(containerId);
        this.spanGrid = [];
        this.initGrid();
    }

    initGrid() {
        this.container.innerHTML = '';
        this.spanGrid = [];

        for (let y = 0; y < this.buffer.height; y++) {
            const rowSpans = [];
            const rowDiv = document.createElement('div');
            // Ensure the row height matches the cell height to avoid gaps
            rowDiv.style.height = 'var(--cell-height)'; 
            rowDiv.style.display = 'flex'; // Use flex to keep spans in a row

            for (let x = 0; x < this.buffer.width; x++) {
                const span = document.createElement('span');
                span.className = 'cell';
                span.textContent = ' ';
                rowDiv.appendChild(span);
                rowSpans.push(span);
            }
            this.container.appendChild(rowDiv);
            this.spanGrid.push(rowSpans);
        }
    }

    render() {
        for (let y = 0; y < this.buffer.height; y++) {
            for (let x = 0; x < this.buffer.width; x++) {
                const cell = this.buffer.cells[y][x];
                if (cell.dirty) {
                    const span = this.spanGrid[y][x];
                    span.textContent = cell.char;
                    span.style.color = cell.fg;
                    span.style.backgroundColor = cell.bg;
                }
            }
        }
    }
}
