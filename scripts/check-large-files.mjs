import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";

// 配置
const rootDir = join(dirname(__dirname), ".."); // 向上两级到 rbq-engine.ts 目录
const outputFile = "large-files.log";
const maxLines = 1000;
const excludeDirs = ["node_modules", "dist", "build", ".git", "coverage"];

// 检查文件是否应该被排除
function shouldExclude(path) {
    const dirParts = path.split("\\");
    return dirParts.some((part) => excludeDirs.includes(part));
}

// 计算文件行数
function countLines(filePath) {
    try {
        const content = readFileSync(filePath, "utf8");
        return content.split("\n").length;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return 0;
    }
}

// 递归扫描目录
function scanDirectory(directory) {
    const largeFiles = [];

    try {
        const items = readdirSync(directory, { withFileTypes: true });

        for (const item of items) {
            const fullPath = join(directory, item.name);

            // 检查是否应该排除
            if (shouldExclude(fullPath)) {
                continue;
            }

            if (item.isDirectory()) {
                // 递归扫描子目录
                const subLargeFiles = scanDirectory(fullPath);
                largeFiles.push(...subLargeFiles);
            } else if (item.isFile() && extname(item.name) === ".ts") {
                // 检查 TypeScript 文件
                const lines = countLines(fullPath);
                if (lines > maxLines) {
                    largeFiles.push({ path: fullPath, lines });
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${directory}:`, error.message);
    }

    return largeFiles;
}

// 主函数
function main() {
    console.log(`Scanning for TypeScript files with more than ${maxLines} lines...`);
    console.log(`Root directory: ${rootDir}`);
    console.log(`Excluding directories: ${excludeDirs.join(", ")}`);

    const largeFiles = scanDirectory(rootDir);

    // 排序文件（按行数降序）
    largeFiles.sort((a, b) => b.lines - a.lines);

    // 生成输出内容
    let output = `Large TypeScript files (${maxLines}+ lines)\n`;
    output += `======================================\n`;
    output += `Found ${largeFiles.length} large files\n\n`;

    if (largeFiles.length > 0) {
        largeFiles.forEach((file) => {
            // 计算相对路径
            const relativePath = file.path.replace(rootDir + "\\", "");
            output += `${relativePath}: ${file.lines} lines\n`;
        });
    } else {
        output += "No large files found!\n";
    }

    // 写入输出文件
    const outputPath = join(rootDir, outputFile);
    try {
        readFileSync(outputPath, "utf8");
        console.log(`Output file ${outputFile} already exists. Overwriting...`);
    } catch (error) {
        // 文件不存在，正常创建
    }

    try {
        import("node:fs").then((fs) => {
            fs.writeFileSync(outputPath, output);
            console.log(`\nScan completed!`);
            console.log(`Results written to: ${outputPath}`);
            console.log(`Found ${largeFiles.length} large files`);
        });
    } catch (error) {
        console.error(`Error writing output file:`, error.message);
    }
}

// 运行主函数
main();
