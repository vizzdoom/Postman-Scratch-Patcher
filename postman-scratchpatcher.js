const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process')
const POSTMAN_REMOTEAPPDATA = path.join(process.env.APPDATA, 'Postman',)
const STORAGE_DIR_PATH = path.join(POSTMAN_REMOTEAPPDATA, 'Storage');
const STORAGE_FILE_PATH = path.join(STORAGE_DIR_PATH, 'userPartitionData.json');
const POSTMAN_LOCALAPPDATA = path.join(process.env.LOCALAPPDATA, "Postman");
const USER_PARTITION_DATA_CONTENT =
`{"migrationCompleted":true,"partitions":{},"users":{},"v8PartitionsNamespaceMeta":{"users":{"activePartition":null}},"v8Partitions":{"0446a2bf-1dc7-4dfd-b12d-6fd568013cac":{"context":{"namespace":"scratchPad","userId":0,"teamId":0},"meta":{"isDirty":false}}}}`;
const SCRATCHPAD_PAYLOAD = `/*SCRATCHPATCHER*/function waitForOverlay(){let e=setInterval(()=>{document.querySelector(".ReactModal__Overlay--after-open")&&(pm.mediator.trigger("hideUserSwitchingExperienceModal"),document.querySelector(".requester-scratchpad-info-container").remove(),clearInterval(e))},200)}waitForOverlay();`;

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

	console.log("[i] Checking if asar command is instlaled in the system via 'npm install -g asar'");
	try {
		console.log("Found " + execSync('asar --version').toString());
	} catch (error) {
		console.error("[-] Cannot execute asar command. Please install via: npm install -g asar");
		process.exit(20);
	}

	console.log("[i] Killing all 'Postman.exe' and child- processes");
	try {
		execSync(`taskkill /F /IM Postman.exe /T`, { stdio: 'ignore'});	
	} catch (error){

	}
}


function writeTxt(filePath, content, overwrite = false){
	writeMode = overwrite ? 'w' : 'a';
	try {
		fs.writeFileSync(filePath, content + "\n", {flag: writeMode});
	}
	catch (error) {
		console.error(`Failed to write to the ${filePath}: ${error}`);
		process.exit(10);
	}
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


function extractAsar(asarFilePath, asarExtractedDirPath){
	if (!fs.existsSync(asarFilePath)) {
		console.error(`[i] The asarFilePath file not exists in: ${asarFilePath}`);
		process.exit(3);
	}
	try {
		console.log(`asar extract "${asarFilePath}" "${asarExtractedDirPath}"`);
		var output = execSync(`asar extract "${asarFilePath}" "${asarExtractedDirPath}"`).toString();
		console.log(output);
		console.log(`[+] Extracted ${asarFilePath} into ${asarExtractedDirPath}`);
	} catch (error) {
			console.log(`[-] Failed to extract ASAR ${asarFilePath} file: ${error.message}`);
			process.exit(4);
	}
}


function createPackage(asarExtractedDirPath, asarFilePath){
	if (fs.existsSync(asarFilePath)) {
		console.log(`[i] The ${asarFilePath} exists - deleting`)
		fs.rmSync(asarFilePath, { force: true });
		console.log("[+] Deleted");
	}
	try {
		execSync(`asar pack "${asarExtractedDirPath}" "${asarFilePath}"`);
		console.log(`[+] Created asar file ${asarFilePath} from the directory ${asarExtractedDirPath}`);
	} catch (error) {
			console.log(`[-] Failed to create ASAR package ${asarFilePath} from the directory ${asarExtractedDirPath}`);
			process.exit(5);
	}
}


function main() {
	console.log("[i] STARTING POSTMAN PATCH PROCESS - SANITY CHECKS");
	sanityCheck();

	console.log("[i] Writing config for turning in the Scratch Pad mode");
	writeTxt(STORAGE_FILE_PATH, USER_PARTITION_DATA_CONTENT, overwrite = true);

	var lightweightClientIndicatorPath = path.join(POSTMAN_REMOTEAPPDATA, "Partitions");
	console.log(`[+] Removing Lightweight Client Indicator directory to disable Lightweight HTTP Client mode: ${lightweightClientIndicatorPath}`);
	var removeLightweightClientIndicator = `rm -f -R --interactive=never "${lightweightClientIndicatorPath}"`;
	console.log(removeLightweightClientIndicator);
	console.log(execSync(removeLightweightClientIndicator).toString());
	
	console.log("[i] Decompressing application");
	let appDirectoryPath = path.join(POSTMAN_LOCALAPPDATA, getLatestAppDirectory());
	console.log(`Detected appDirectoryPath: ${appDirectoryPath}`);
	let appAsarFilePath = path.join(appDirectoryPath, "resources", "app.asar");
	let asarExtractedDirPath = path.join(appAsarFilePath, "..", "asar-extracted");
	console.log(`[i] Extracting asar file: ${appAsarFilePath} into ${asarExtractedDirPath}`);
	if (fs.existsSync(asarExtractedDirPath)) {
		console.log("[i] The asarExtractedDirPath exists - deleting old one")
		fs.rmSync(asarExtractedDirPath, { recursive: true, force: true });
		console.log("[+] Deleted");
	}
	console.log("[i] Creating temporary directory for the extracted asar");
	fs.mkdirSync(asarExtractedDirPath);
	console.log("[+] Created");
	console.log(`[i] Extracting asar file ${appAsarFilePath} into ${asarExtractedDirPath}`);
	extractAsar(appAsarFilePath, asarExtractedDirPath);
	console.log("[i] Injecting payload");
	let payloadFilePath = path.join(asarExtractedDirPath, "js", "scratchpad", "scratchpad.js")

	fileContent = fs.readFileSync(payloadFilePath, 'utf8')
	let lines = fileContent.split("\n")
	if (lines[lines.length - 1].trim().startsWith('/*SCRATCHPATCHER*/')){
		console.log("[i] Removing old /*SCRATCHPATCHER*/ payload");
		lines.pop();
	}
	lines.push(SCRATCHPAD_PAYLOAD);
	fs.writeFileSync(payloadFilePath, lines.join("\n", "utf8"));
	console.log(`[+] Injected into ${payloadFilePath}`);
	
	console.log(`[i] Createing asar file ${appAsarFilePath} from the directory ${asarExtractedDirPath}`);
	createPackage(asarExtractedDirPath, appAsarFilePath);
	console.log("[+] Created");
	console.log("[+++] Postman patched");
}

main()