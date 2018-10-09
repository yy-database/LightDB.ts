import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 配置
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, ".."); // 向上一级到 rbq-engine.ts 目录
const excludeDirs = ["node_modules", "dist", "build", ".git", "coverage"];

// 解析命令行参数
const args = process.argv.slice(2);
let versionType = args[0];
let customVersion = null;

// 检查是否是自定义版本
if (versionType && versionType.match(/^\d+\.\d+\.\d+(?:-.*)?$/)) {
    customVersion = versionType;
    versionType = "custom";
}

// 验证版本类型
const validVersionTypes = ["patch", "minor", "major", "prerelease", "prepatch", "preminor", "premajor", "custom"];
if (versionType && !validVersionTypes.includes(versionType)) {
    console.error(`Invalid version type: ${versionType}`);
    console.error(`Valid options: ${validVersionTypes.filter((v) => v !== "custom").join(", ")} or custom version`);
    process.exit(1);
}

// 交互式模式
async function interactiveMode() {
    const inquirer = await import("inquirer");
    const answers = await inquirer.default.prompt([
        {
            type: "select",
            name: "versionType",
            message: "Select version bump type:",
            choices: [
                { name: "patch (0.0.1 → 0.0.2)", value: "patch" },
                { name: "minor (0.0.1 → 0.1.0)", value: "minor" },
                { name: "major (0.0.1 → 1.0.0)", value: "major" },
                { name: "custom version", value: "custom" },
            ],
            default: 0,
        },
        {
            type: "input",
            name: "customVersion",
            message: "Enter custom version:",
            when: (answers) => answers.versionType === "custom",
            validate: (input) => {
                if (!input.match(/^\d+\.\d+\.\d+(?:-.*)?$/)) {
                    return "Please enter a valid version number (e.g., 1.0.0, 1.0.0-beta.1)";
                }
                return true;
            },
        },
    ]);

    if (answers.versionType === "custom") {
        return { type: "custom", version: answers.customVersion };
    }

    return { type: answers.versionType };
}

// 检查文件是否应该被排除
function shouldExclude(path) {
    const dirParts = path.split("\\");
    return dirParts.some((part) => excludeDirs.includes(part));
}

// 递归查找所有 package.json 文件
function findPackageJsonFiles(directory) {
    const packageFiles = [];

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
                const subPackageFiles = findPackageJsonFiles(fullPath);
                packageFiles.push(...subPackageFiles);
            } else if (item.isFile() && item.name === "package.json") {
                // 找到 package.json 文件
                packageFiles.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${directory}:`, error.message);
    }

    return packageFiles;
}

// 解析版本号
function parseVersion(version) {
    const parts = version.split(".");
    return {
        major: parseInt(parts[0]),
        minor: parseInt(parts[1]),
        patch: parseInt(parts[2].split("-")[0]),
    };
}

// 递增版本号
function incrementVersion(currentVersion, type) {
    const version = parseVersion(currentVersion);

    switch (type) {
        case "major":
            version.major++;
            version.minor = 0;
            version.patch = 0;
            break;
        case "minor":
            version.minor++;
            version.patch = 0;
            break;
        case "patch":
            version.patch++;
            break;
        // 对于 prerelease 类型，这里简化处理，实际项目中可能需要更复杂的逻辑
        case "prerelease":
        case "prepatch":
        case "preminor":
        case "premajor":
            version.patch++;
            break;
    }

    return `${version.major}.${version.minor}.${version.patch}`;
}

// 主函数
async function main() {
    // 处理交互式模式
    if (!versionType) {
        console.log("Interactive mode selected\n");
        const result = await interactiveMode();
        versionType = result.type;
        customVersion = result.version;
    }

    console.log(`Bumping version with type: ${versionType}${customVersion ? ` (${customVersion})` : ""}`);
    console.log(`Root directory: ${rootDir}`);

    // 查找所有 package.json 文件
    const packageFiles = findPackageJsonFiles(rootDir);
    console.log(`Found ${packageFiles.length} package.json files`);

    // 读取根目录的 package.json 文件，获取当前版本
    const rootPackagePath = join(rootDir, "package.json");
    let rootPackage;
    try {
        const content = readFileSync(rootPackagePath, "utf8");
        rootPackage = JSON.parse(content);
    } catch (error) {
        console.error(`Error reading root package.json:`, error.message);
        process.exit(1);
    }

    // 计算新版本
    const currentVersion = rootPackage.version || "0.0.0";
    let newVersion;

    if (versionType === "custom" && customVersion) {
        newVersion = customVersion;
    } else {
        newVersion = incrementVersion(currentVersion, versionType);
    }

    console.log(`Updating version from ${currentVersion} to ${newVersion}`);

    // 更新所有 package.json 文件
    let updatedCount = 0;

    for (const packagePath of packageFiles) {
        try {
            // 读取 package.json 文件
            const content = readFileSync(packagePath, "utf8");
            const packageJson = JSON.parse(content);

            // 更新版本号
            if (packageJson.version) {
                packageJson.version = newVersion;

                // 写入更新后的文件
                writeFileSync(packagePath, JSON.stringify(packageJson, null, 4));
                console.log(`Updated: ${packagePath.replace(rootDir + "\\", "")}`);
                updatedCount++;
            }
        } catch (error) {
            console.error(`Error updating ${packagePath}:`, error.message);
        }
    }

    console.log(`\nUpdate completed!`);
    console.log(`Updated ${updatedCount} package.json files to version ${newVersion}`);
}

// 运行主函数
main().catch((error) => {
    console.error(`Error:`, error.message);
    process.exit(1);
});
