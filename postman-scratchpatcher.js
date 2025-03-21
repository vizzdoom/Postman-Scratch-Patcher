const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process')
const POSTMAN_REMOTEAPPDATA = path.join(process.env.APPDATA, 'Postman',)
const STORAGE_DIR_PATH = path.join(POSTMAN_REMOTEAPPDATA, 'Storage');
const STORAGE_FILE_PATH = path.join(STORAGE_DIR_PATH, 'userPartitionData.json');
const POSTMAN_LOCALAPPDATA = path.join(process.env.LOCALAPPDATA, "Postman");
const USER_PARTITION_DATA_CONTENT =
`{"migrationCompleted":true,"partitions":{},"users":{},"v8PartitionsNamespaceMeta":{"users":{"activePartition":null}},"v8Partitions":{"0446a2bf-1dc7-4dfd-b12d-6fd568013cac":{"context":{"namespace":"scratchPad","userId":0,"teamId":0},"meta":{"isDirty":false}}}}`;
const SCRATCHPAD_PAYLOAD_MARKER = "/*SCRATCHPATCHER*/";
const SCRATCHPAD_PAYLOAD = SCRATCHPAD_PAYLOAD_MARKER + `interval=setInterval(()=>{if(document.querySelector(".switching-to-offlineAPIClient")){pm.mediator.trigger("hideUserSwitchingExperienceModal");document.querySelector(".requester-scratchpad-info-container").remove();clearInterval(interval);}},200);`;
const SWITCH_REMOVE_LIGHTWEIGHT = process.argv.includes('--remove-lightweight');
const SWITCH_HELP = process.argv.includes('--help') || process.argv.includes('-h');
const SWITCH_PATCH = process.argv.includes("patch");

function sanityCheck(){
	if (!fs.existsSync(STORAGE_DIR_PATH)) {
		console.error(`[-] Cannot find Postman STORAGE_DIR_PATH in ${STORAGE_DIR_PATH}`);
		console.error("[i] It looks like Postman has not been run on this system before.");
		console.error("[i] Please re/install Postman and run it at least once before you run this script.");
		process.exit(1);
	}
	
	if (!fs.existsSync(POSTMAN_LOCALAPPDATA)) {
		console.error(`[-] Cannot find Postman LOCALAPPDATA in ${POSTMAN_LOCALAPPDATA}`);
		console.error("[i] Please re/install Postman and run it at least once before you run this script.");
		process.exit(2);
	}

	console.log("[i] Checking if asar command is installed in the system via 'npm install -g asar'");
	try {
		executeOsCommand('asar --version');
	} catch (error) {
		console.error("[-] Cannot execute asar command. Please install via: npm install -g asar");
		process.exit(3);
	}

	console.log("[i] Killing all 'Postman.exe' with child processes and tear-down few seconds");
	try {
		executeOsCommand(`taskkill /F /IM Postman.exe /T`, { stdio: 'ignore'});
		console.log("Tear-down...");
		executeOsCommand(`sleep 3`, { stdio: 'ignore'});
	} catch (error){
		console.log("[+] Killed")
	}
}


function writeTxt(filePath, content, overwrite = false){
	writeMode = overwrite ? 'w' : 'a';
	try {
		fs.writeFileSync(filePath, content + "\n", {flag: writeMode});
	}
	catch (error) {
		console.error(`Failed to write to the ${filePath}: ${error}`);
		process.exit(4);
	}
}


function executeOsCommand(cmd, options = {}){
	console.log(`[i] System command execution in progress: ${cmd}`);
	var output = execSync(cmd, options).toString();
	console.log(output);
	return output;
}


function getLatestAppDirectory(){
	
	var directories = fs.readdirSync(POSTMAN_LOCALAPPDATA)
						.filter(name => name.startsWith('app-'))
						.map(name => ({
							name, 
							fullPath: path.join(POSTMAN_LOCALAPPDATA, name), 
							modifiedTime: fs.statSync(path.join(POSTMAN_LOCALAPPDATA, name)).mtimeMs
						}))
						.filter(entry => fs.statSync(entry.fullPath).isDirectory())
						.sort((a, b) => b.modifiedTime - a.modifiedTime);
						
	return directories.length > 0 ? directories[0].name : null;
}


function createPackage(asarExtractedDirPath, asarFilePath){
	if (fs.existsSync(asarFilePath)) {
		console.log(`[i] The ${asarFilePath} exists - deleting`)
		fs.rmSync(asarFilePath, { force: true });
		console.log("[+] Deleted");
	}
	try {
		executeOsCommand(`asar pack "${asarExtractedDirPath}" "${asarFilePath}"`);
		console.log(`[+] Created asar file ${asarFilePath} from the directory ${asarExtractedDirPath}`);
	} catch (error) {
			console.log(`[-] Failed to create ASAR package ${asarFilePath} from the directory ${asarExtractedDirPath}`);
			process.exit(5);
	}
}


function removeLightweightClientMode() {
	var lightweightClientIndicatorPath = path.join(POSTMAN_REMOTEAPPDATA, "Partitions");
	if (fs.existsSync(lightweightClientIndicatorPath) && fs.statSync(lightweightClientIndicatorPath).isDirectory()){
		try {
			console.log(`[i] Removing directory: ${lightweightClientIndicatorPath}`);
			fs.rmSync(lightweightClientIndicatorPath, { recursive: true, force: true });
		} catch (error) {
			console.log(`[-] Error during remove ${lightweightClientIndicatorPath} directory: ${error}`);
		}
	}
}


function patchApplication(){
	let appDirectoryPath = path.join(POSTMAN_LOCALAPPDATA, getLatestAppDirectory());
	let appAsarFilePath = path.join(appDirectoryPath, "resources", "app.asar");
	let asarExtractedDirPath = path.join(appDirectoryPath, "resources", "carved_tmp_directory");
	
	console.log(`\n=== DECOMPRESSING AN APPLICATION === ${asarExtractedDirPath}`);
	patchApplication_decompressApp(appAsarFilePath, asarExtractedDirPath);

	console.log("\n=== INJECTING PAYLOAD ===");
	patchApplication_injectPayload(path.join(asarExtractedDirPath, "js", "scratchpad", "scratchpad.js"));
	
	console.log("\n=== PACKING MODIFIED APPLICATION ===");
	patchApplication_packModifiedApp(asarExtractedDirPath, appAsarFilePath);
}


function patchApplication_decompressApp(asarFile, asarExtractedDir){
	console.log(`Using asarExtractedDirPath temporary directory for decompression: ${asarExtractedDir}`);
	if (fs.existsSync(asarExtractedDir)) {
		console.log("[i] The asarExtractedDirPath exists - deleting old one")
		fs.rmSync(asarExtractedDir, { recursive: true, force: true });
		console.log("[+] Deleted");
	}

	console.log(`Creating temporary directory for the extracted asar: ${asarExtractedDir}` );
	fs.mkdirSync(asarExtractedDir);
	console.log("[+] Created");

	console.log(`Extracting asar file ${asarFile} into ${asarExtractedDir}`);
	if (!fs.existsSync(asarFile)) {
		console.error(`[i] The asar file not exists in: ${asarFile}`);
		process.exit(6);
	}
	try {
		var command = `asar extract "${asarFile}" "${asarExtractedDir}"`;
		executeOsCommand(command);
		console.log(`[+] Extracted ${asarFile} into ${asarExtractedDir}`);
	} catch (error) {
		console.log(`[-] Failed to extract ASAR ${asarFile} file: ${error.message}`);
		process.exit(7);
	}
}


function patchApplication_injectPayload(payloadFilePath){
	fileContent = fs.readFileSync(payloadFilePath, 'utf8')
	let lines = fileContent.split("\n")
	if (lines[lines.length - 1].trim().startsWith(SCRATCHPAD_PAYLOAD_MARKER)){
		console.log(`[i] Found ${SCRATCHPAD_PAYLOAD_MARKER} payload marker. Removing old payload.`);
		lines.pop();
	}
	lines.push(SCRATCHPAD_PAYLOAD);
	fs.writeFileSync(payloadFilePath, lines.join("\n", "utf8"));
	console.log(`[+] Payload injected into ${payloadFilePath}`);
}


function patchApplication_packModifiedApp(asarExtractedDirPath, appAsarFilePath){
	console.log(`Creating an asar file ${appAsarFilePath} from the directory ${asarExtractedDirPath}`);
	createPackage(asarExtractedDirPath, appAsarFilePath);
	console.log("[+] Created");
}


function showHelp(){
		console.log("This program patches Postman to enable Scratch Pad mode for working without online services.");
		console.log("Usage: node postman-scratchpather.js patch [--remove-lightweight] [-h|--help]");
		console.log("\t--remove-lightweight:\tdisables lightweight HTTP client mode and activates Scratch Pad");
		console.log("\t\t\t\t**it will remove all your local collections and environments**");
		process.exit(0);
}


function main() {
	if (SWITCH_HELP || !SWITCH_PATCH){
		showHelp();
	}
	console.log("\n=== SANITY CHECKS ===");
	sanityCheck();

	console.log("\n=== TURNING ON A SCRATCH PAD MODE ===");
	writeTxt(STORAGE_FILE_PATH, USER_PARTITION_DATA_CONTENT, overwrite = true);

	if (SWITCH_REMOVE_LIGHTWEIGHT) {
		console.log("\n=== DISABLE LIGHTWEIGH HTTP CLIENT MODE (--remove-lightweight) ===");
		removeLightweightClientMode();
	} else {
		console.log("\n=== SKIPPING REMOVING OF A LIGHTWEIGH HTTP CLIENT MODE (can be turned on by --remove-lightweight) ===");
	}
	
	patchApplication();

	console.log("\n=== PATCHING COMPLETED. RUN POSTMAN. ===");
}

main()