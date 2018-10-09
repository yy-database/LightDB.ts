#!/usr/bin/env node

/**
 * check-info.mjs - 检查所有包的 README 和 package.json 完整性
 *
 * 检查内容：
 * 1. README.md 是否存在
 * 2. package.json 必要字段是否完整
 */

import { readdir, readFile, stat, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * 必要的 package.json 字段
 */
const REQUIRED_FIELDS = ["name", "version", "description", "author", "license", "repository", "keywords"];

/**
 * 推荐的 package.json 字段
 */
const RECOMMENDED_FIELDS = ["homepage", "bugs", "main", "types"];

/**
 * 检查结果
 */
const results = {
    errors: [],
    warnings: [],
    packages: [],
};

/**
 * 扫描目录下的所有包
 */
async function scanPackages(dir, category) {
    const entries = await readdir(dir, { withFileTypes: true });
    const packages = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const packageDir = join(dir, entry.name);
        const packageJsonPath = join(packageDir, "package.json");
        const readmePath = join(packageDir, "README.md");
        const readmeLowerPath = join(packageDir, "readme.md");

        try {
            await stat(packageJsonPath);
        } catch {
            continue; // 不是包目录
        }

        const pkgInfo = {
            name: entry.name,
            path: packageDir,
            category,
            hasReadme: false,
            readmePath: null,
            packageJson: null,
            missingFields: [],
            recommendedFields: [],
            errors: [],
            warnings: [],
        };

        // 检查 README
        let hasReadme = false;

        // 检查大写的 README.md
        let checkUpperReadme = false;
        try {
            await stat(readmePath);
            checkUpperReadme = true;
        } catch {
            checkUpperReadme = false;
        }

        if (checkUpperReadme) {
            // 发现大写的 README.md，自动修复为小写
            await rename(readmePath, readmeLowerPath);
            hasReadme = true;
        } else {
            // 检查小写的 readme.md
            let checkLowerReadme = false;
            try {
                await stat(readmeLowerPath);
                checkLowerReadme = true;
            } catch {
                checkLowerReadme = false;
            }

            if (checkLowerReadme) {
                hasReadme = true;
            } else {
                // 自动创建 readme.md
                await writeFile(readmeLowerPath, "", "utf-8");
                hasReadme = true;
            }
        }

        pkgInfo.hasReadme = hasReadme;
        pkgInfo.readmePath = "readme.md";

        // 检查 README 内容长度
        if (hasReadme) {
            try {
                const readmeContent = await readFile(readmeLowerPath, "utf-8");
                const readmeLength = readmeContent.trim().length;
                if (readmeLength > 0 && readmeLength < 200) {
                    const warningMsg = `README.md content is too short (${readmeLength} characters), should be at least 200 characters`;
                    pkgInfo.warnings.push(warningMsg);
                    results.warnings.push(`[${category}/${entry.name}] ${warningMsg}`);
                }
            } catch (err) {
                const errorMsg = `Failed to read README.md: ${err.message}`;
                pkgInfo.errors.push(errorMsg);
                results.errors.push(`[${category}/${entry.name}] ${errorMsg}`);
            }
        }

        // 检查 package.json
        try {
            const content = await readFile(packageJsonPath, "utf-8");
            pkgInfo.packageJson = JSON.parse(content);

            // 检查必要字段
            for (const field of REQUIRED_FIELDS) {
                if (!pkgInfo.packageJson[field]) {
                    pkgInfo.missingFields.push(field);
                    pkgInfo.errors.push(`Missing required field: ${field}`);
                    results.errors.push(`[${category}/${entry.name}] Missing required field in package.json: ${field}`);
                }
            }

            // 检查推荐字段
            for (const field of RECOMMENDED_FIELDS) {
                if (!pkgInfo.packageJson[field]) {
                    pkgInfo.recommendedFields.push(field);
                    pkgInfo.warnings.push(`Missing recommended field: ${field}`);
                    results.warnings.push(`[${category}/${entry.name}] Missing recommended field in package.json: ${field}`);
                }
            }
        } catch (err) {
            pkgInfo.errors.push(`Failed to read package.json: ${err.message}`);
            results.errors.push(`[${category}/${entry.name}] Failed to read package.json: ${err.message}`);
        }

        packages.push(pkgInfo);
    }

    return packages;
}

/**
 * 打印结果
 */
function printResults() {
    console.log("\n" + "=".repeat(80));
    console.log("📊 Package Info Check Results");
    console.log("=".repeat(80) + "\n");

    // 按类别分组打印
    const categories = [...new Set(results.packages.map((p) => p.category))];

    for (const category of categories) {
        const packages = results.packages.filter((p) => p.category === category);
        console.log(`\n📁 ${category.toUpperCase()}`);
        console.log("-".repeat(40));

        for (const pkg of packages) {
            const status = pkg.errors.length === 0 ? "✅" : "❌";
            const readmeStatus = pkg.hasReadme ? "📖" : "📄";
            console.log(`  ${status} ${readmeStatus} ${pkg.name}`);

            if (pkg.errors.length > 0) {
                for (const error of pkg.errors) {
                    console.log(`      ❌ ${error}`);
                }
            }
            if (pkg.warnings.length > 0) {
                for (const warning of pkg.warnings) {
                    console.log(`      ⚠️  ${warning}`);
                }
            }
        }
    }

    // 汇总
    console.log("\n" + "=".repeat(80));
    console.log("📈 Summary");
    console.log("=".repeat(80));
    console.log(`  Total packages: ${results.packages.length}`);
    console.log(`  ✅ Passed: ${results.packages.filter((p) => p.errors.length === 0).length}`);
    console.log(`  ❌ Failed: ${results.packages.filter((p) => p.errors.length > 0).length}`);
    console.log(`  📄 Missing README: ${results.packages.filter((p) => !p.hasReadme).length}`);
    console.log(`  ❌ Errors: ${results.errors.length}`);
    console.log(`  ⚠️  Warnings: ${results.warnings.length}`);

    // 详细错误列表
    if (results.errors.length > 0) {
        console.log("\n❌ Errors:");
        for (const error of results.errors) {
            console.log(`  - ${error}`);
        }
    }

    if (results.warnings.length > 0) {
        console.log("\n⚠️  Warnings:");
        for (const warning of results.warnings) {
            console.log(`  - ${warning}`);
        }
    }

    console.log("\n" + "=".repeat(80) + "\n");

    return results.errors.length === 0;
}

/**
 * 主函数
 */
async function main() {
    console.log("🔍 Checking package info...\n");

    // 扫描 compilers
    const compilersDir = join(rootDir, "compilers");
    const compilersPackages = await scanPackages(compilersDir, "compilers");
    results.packages.push(...compilersPackages);

    // 扫描 runtimes
    const runtimesDir = join(rootDir, "runtimes");
    const runtimesPackages = await scanPackages(runtimesDir, "runtimes");
    results.packages.push(...runtimesPackages);

    // 打印结果
    const success = printResults();

    // 退出码
    process.exit(success ? 0 : 1);
}

main().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
