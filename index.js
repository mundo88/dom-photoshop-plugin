// RESTful API example.
// This example gets a weather forecast from weather.gov and places it on a text layer in the current document.
// 
const app = require('photoshop').app
const {executeAsModal} = require("photoshop").core;
const {batchPlay} = require("photoshop").action;
const formats = require('uxp').storage.formats
// const socket_url = "https://share-psd-server-f0702320bf16.herokuapp.com"
const socket_url = "http://127.0.0.1:8080/"
const root_url = "https://www.dom2.shop"
const listener = (e,d) => {
	console.log(e);
	if((e=="select" && d._target[0]._ref =="document" )|| e=="save" || e=="open" || e=="close" ||e=="make" && d.new._obj =="document" ) {
		const docummentName =  app.activeDocument.name
		$("#file_name").val(docummentName)
		
		console.log(e,d);
	}
}
require('photoshop').action.addNotificationListener(["save","open","select","close","make"],listener);

showFile()
showFolder()
showVector()
showBackground()
var socket = io(socket_url);
socket.on('connect', function() {
	socket.emit('message', {data: 'I\'m connected!'});
});
socket.on('message', function(data) {
	console.log(data);
	data.attr = {
		"data-file": data.url,
		"data-id": data.fileName,
	}
	$("[data-panel='file']").prepend(fileCard(data))
	$("#file_name").val(data.fileName)
});

async function showFile() {
	let response = await fetch(socket_url+"/psd");
	console.log(response);
	if (!response.ok) {
		throw new Error(`HTTP error fetching forecast; status: ${response.status}`);
	}
	let dataJson = await response.json();
	$("[data-panel='file']").html("")
	$(dataJson.data).each((index,data) => {
		console.log(data);
		$("[data-panel='file']").prepend(fileCard(data))
	})
	return dataJson;
}
const fileCard =(data={})=>{
	try {
		const elm = $(`
		<div class="w-1/2 p-2 h-auto " data-file="${data.url}" data-file-name="${data.fileName}">
		  <div class="flex relative items-center overflow-hidden rounded-xl flex-col justify-between hover:bg-[#282828] bg-[#424242] duration-200 w-full h-full  cursor-pointer">
		  	<div style="display:none" class="loading w-full h-full absolute top-0 left-0 z-10 rounded-xl flex items-center justify-center p-4 bg-[#282828]/70">
				<span class="text-sm text-white/75 font-medium" >Đang tải...</span>
			  <img class="w-8 h-auto" src="/icons/loading.gif" alt="">
	  		</div>
			  <div class="w-full aspect-square h-full relative bg-[#282828]">
			  	<img class="w-full h-full object-contain hover:scale-110" src="${data.thumbnail}" alt="">
			  </div>
			  <div class="p-3 flex space-x-2 items-center">
			  	<img class="w-8 h-auto" src="/icons/ps-64.png" alt="">
			  	<sp-label class="text-md text-medium text-white ">${data.fileName}</sp-label>
			  </div>
		  </div>
		</div>
	  `)
	  return elm
	} catch (error) {
		return `<div class="pointer-events-none px-2 py-2 w-1/2">${error.message}</div>`
	}	
}

const imgUrlToBuffer= async (imgUrl) => {
	const data = await fetch(imgUrl)
	const blod = await data.blob();
	const buffer = await blod.arrayBuffer()
	return buffer
}
async function imgToLayer(imgUrl, image_name='dom_vector.svg') {
	const img = await imgUrlToBuffer(imgUrl)
    try {
        const img_name = image_name
		const storage 	= await require('uxp').storage
		const fs = storage.localFileSystem
        const folder = await fs.getTemporaryFolder()
        const file = await folder.createFile(img_name, { overwrite: true })
        await file.write(img, { format: storage.formats.binary })

        const token = await fs.createSessionToken(file) // batchPlay requires a token on _path

        let place_event_result
        let imported_layer
        await executeAsModal(async () => {
            const result = await batchPlay(
                [
                    {
                        _obj: 'placeEvent',
                        null: {
                            _path: token,
                            _kind: 'local',
                        },
                        freeTransformCenterState: {
                            _enum: 'quadCenterState',
                            _value: 'QCSAverage',
                        },
                        offset: {
                            _obj: 'offset',
                            horizontal: {
                                _unit: 'pixelsUnit',
                                _value: 0,
                            },
                            vertical: {
                                _unit: 'pixelsUnit',
                                _value: 0,
                            },
                        },
                        _isCommand: true,
                        _options: {
                            dialogOptions: 'dontDisplay',
                        },
                    },
                ],
                {
                    synchronousExecution: true,
                    modalBehavior: 'execute',
                }
            )
            console.log('placeEmbedd batchPlay result: ', result)

            place_event_result = result[0]
            imported_layer = await app.activeDocument.activeLayers[0]
        })
        return imported_layer
    } catch (e) {
        console.warn(e)
    }

    // return place_event_result
}
async function readFile(fileUrl,batchCommand,file_name){
    try {
		const data = await fetch(fileUrl)
		const blod = await data.blob();
		const file_download = await blod.arrayBuffer()
        let place_event_result
        let imported_layer
		if (!file_name) {
			file_name = await data.headers.map["content-disposition"].split("filename=")[1]
		}
		const storage 	= await require('uxp').storage
		const fs = storage.localFileSystem
		const folder = await fs.getTemporaryFolder()
        const file = await folder.createFile(file_name, { overwrite: true })
        await file.write(file_download, { format: storage.formats.binary })
        const token = await fs.createSessionToken(file)
		batchCommand.null._path =  token


        await executeAsModal(async () => {
            const result = await batchPlay([batchCommand],{synchronousExecution: true,modalBehavior: 'execute',})
            console.log('placeEmbedd batchPlay result: ', result)

            place_event_result = result[0]
            imported_layer = await app.activeDocument.activeLayers[0]
        })
        return {imported_layer,place_event_result,token}
    } catch (e) {
        console.warn(e)
    }
}
async function promptFile() {
	const r1 = await prompt(
		'Mở file',
		'Mở file bằng cách tạo layer hoặc mở trong cửa sổ mới?',
		['Thoát', 'Tạo layer','Cửa sổ mới']
	)
	return r1
}
async function addFileCommand({prompt,token}) {
	let batchCommand;
	switch (prompt) {
		case "Tạo layer":
			batchCommand ={
				_obj: 'placeEvent',
				null: {
					_path: token,
					_kind: 'local',
				},
				freeTransformCenterState: {
					_enum: 'quadCenterState',
					_value: 'QCSAverage',
				},
				offset: {
					_obj: 'offset',
					horizontal: {
						_unit: 'pixelsUnit',
						_value: 0,
					},
					vertical: {
						_unit: 'pixelsUnit',
						_value: 0,
					},
				},
				_isCommand: true,
				_options: {
					dialogOptions: 'dontDisplay',
				},
			}
			break;
		case "Cửa sổ mới":
			batchCommand = {
				"_obj": "open",
				"dontRecord": false,
				"forceNotify": true,
				"null": {
					"_path": token,
					"_kind": "local"
				},
				"_isCommand": true
			}
			break;			
		default:
			break;
	}
	await executeAsModal(async () => {
		const result = await batchPlay([batchCommand],{synchronousExecution: true,modalBehavior: 'execute',})

		place_event_result = result[0]
		imported_layer = app.activeDocument.activeLayers[0]
	})
	return {imported_layer,place_event_result,token}
}
async function getDataFile(token) {
	console.log(token);
	try {
		const prompt = await promptFile()
		addFileCommand({prompt,token})
	} catch (error) {
		console.log(error);	
	}

}
async function getFileToken(fileName) {
	try {
		const storage 	= await require('uxp').storage
		const fs = storage.localFileSystem
		const folder = await fs.getTemporaryFolder()
		const file = await folder.getEntry(fileName)
		const token = await fs.createSessionToken(file)
		$('.loading').hide()
		return token
	} catch (error) {
		return false
	}
}
async function downloadFile(fileUrl) {
	try {
		const data = await fetch(fileUrl)
		const blod = await data.blob();
		const file_download = await blod.arrayBuffer()
		const file_name = await data.headers.map["content-disposition"].split("filename=")[1]
		const storage 	= await require('uxp').storage
		const fs = storage.localFileSystem
		const folder = await fs.getTemporaryFolder()
        const file = await folder.createFile(file_name, { overwrite: true })
        await file.write(file_download, { format: storage.formats.binary })
        const token = await fs.createSessionToken(file)
		$('.loading').hide()
		return  token
    } catch (e) {
        console.warn(e)
    }
}
async function shareFile() {
	try {
	
		const storage = await require('uxp').storage
		const fs = await storage.localFileSystem
	
		let entry = await fs.getFileForOpening({path:app.activeDocument.path});
		let token = fs.createSessionToken(entry);
		let native_path = entry.path
		$("#file_name").val(entry.name)
		const formData = new window.FormData()
		formData.append("file",entry)
		$("#shareFile").html("Đang tải..")
		$("#shareFile").attr({
			style:"background-color: #7dace6"
		})
		const res = await fetch(socket_url+"/psd",{
			method: 'POST',
			body: formData
		})
		console.log(formData);
		const data = await res.json()
		console.log(data);
		$("#shareFile").removeAttr("style")
		$("#shareFile").html("Chọn file")

	} catch (error) {
		console.warn(error);
	}
}
async function showVector() {
	const data = await getImgageData(type="vector")
	for(let i = 0; i < data.vectors.length; i++) {
		var vector = data.vectors[i]
		const vectorElm = $(`<div class="px-2 py-2 w-1/2 h-auto" data-folder="${vector.category_id}">
		<div class="flex items-center hover:bg-[#282828] bg-[#424242] duration-200 w-full h-full p-4 rounded-md cursor-pointer">
			<img src="${root_url+vector.url}">
		</div>
		</div>`)
		$('[data-panel="vector"]').append(vectorElm)
		vectorElm.on('click',async function(){
			try {
				const imgUrl = $(this).find("img").attr("src");
				await imgToLayer(imgUrl);
			
			} catch (error) {
				console.error(error)
			}
	
		})
	}
}
async function showBackground() {
	const data = await getImgageData(type="background")
	for(let i = 0; i < data.vectors.length; i++) {
		var vector = data.vectors[i]
		const vectorElm = $(`<div class="px-2 py-2 w-1/2 h-auto ">
		<div class="flex items-center hover:bg-[#282828] bg-[#424242] duration-200 w-full h-full p-4 rounded-md cursor-pointer">
			<img src="${root_url+vector.url}" alt="">
		</div>
		</div>`)
		$('[data-panel="background"]').append(vectorElm)
		vectorElm.on('click',async function(){
			try {
				const imgUrl = $(this).find("img").attr("src");
				await imgToLayer(imgUrl);
			
			} catch (error) {
				console.error(error)
			}
	
		})
	}
}
async function showFolder() {
	let response = await fetch(root_url+"/file_manage/categories");
	if (!response.ok) {
		throw new Error(`HTTP error fetching forecast; status: ${response.status}`);
	}
	let dataJson = await response.json();
	for(let i = 0; i < dataJson.categories.length; i++) {
		var category = dataJson.categories[i]
		const categoryElm = $(`
			<a class="w-full h-12  bg-center rounded-md overflow-hidden" data-category="${category.id}" style="background-image:url(${category.thumbnail})"> 
				<div class="w-full h-full bg-black/70 hover:bg-black/80 flex items-center justify-center">
					<span class="text-xl text-white">${category.name}</span>
				</div>
			</a>
		`)
		$('[data-tabs-id="vector"]>[data-categories]').append(categoryElm)

	}
}
async function getImgageData(type="vector") {
	let response = await fetch(root_url+"/file_manage/image?type="+type);
	if (!response.ok) {
		throw new Error(`HTTP error fetching forecast; status: ${response.status}`);
	}
	let dataJson = await response.json();
	return dataJson;
}
function showAlert(message) {
	const core = require('photoshop').app;
	core.showAlert(message);
	core.showAlert
}
async function prompt(
    heading,
    body,
    buttons = ['Cancel', 'Ok'],
    options = { title: heading, size: { width: 450, height: 280 } }
) {
    const [dlgEl, formEl, headingEl, dividerEl, bodyEl, footerEl] = [
        'dialog',
        'form',
        'sp-heading',
        'sp-divider',
        'sp-body',
        'footer',
    ].map((tag) => document.createElement(tag));
	[headingEl, dividerEl, bodyEl, footerEl].forEach((el) => {
        el.style.margin = '6px'
        el.style.width = 'calc(100% - 12px)'
    });

    formEl.setAttribute('method', 'dialog')
    formEl.addEventListener('submit', () => dlgEl.close())

    footerEl.style.marginTop = '26px'

    dividerEl.setAttribute('size', 'large')

    headingEl.textContent = heading

    bodyEl.textContent = body

    buttons.forEach((btnText, idx) => {
        const btnEl = document.createElement('sp-button')
        btnEl.setAttribute(
            'variant',
            idx === buttons.length - 1 ? btnText.variant || 'cta' : 'secondary'
        )
        if (idx === buttons.length - 1)
            btnEl.setAttribute('autofocus', 'autofocus')
        if (idx < buttons.length - 1) btnEl.setAttribute('quiet')
        btnEl.textContent = btnText.text || btnText
        btnEl.style.marginLeft = '12px'
        btnEl.addEventListener('click', () =>
            dlgEl.close(btnText.text || btnText)
        )
        footerEl.appendChild(btnEl)
    })
    ;[headingEl, dividerEl, bodyEl, footerEl].forEach((el) =>
        formEl.appendChild(el)
    )
    dlgEl.appendChild(formEl)
    document.body.appendChild(dlgEl)

    return dlgEl.uxpShowModal(options)
}
$(document).on('click', '.sp-tab',function(e) {
	$('.sp-tab.selected').removeClass('selected');
	$(this).addClass('selected');
	$("[data-tabs-id]").hide()
	$(`[data-tabs-id="${$(this).attr('id')}"]`).show()
})
$(document).on('click', '[data-category]' , function(e) {
	const folder = $(this).attr('data-category')
	$('[data-tabs-id="vector"]>[data-categories]').hide()
	if (folder=='all') {
		$(`[data-folder]`).show()
	}
	else {
		$(`[data-folder]`).hide()
		$(`[data-folder="${folder}"]`).show()
	}
	$('[data-tabs-id="vector"]>[ data-vectors]').show()

})
$(document).on('click', '.back-folder' , function(e) {
	$(`[data-vectors]`).hide()
	$('[data-categories]').show()
})
$(document).on('click', '[data-file]' ,async function(e) {
	try {
		if($(this).attr('data-token') !=null) {
			const token = $(this).attr('data-token')
			await getDataFile(token)
		}else {
			$(this).find('.loading').show()
			const token = await getFileToken(fileName=$(this).attr('data-file-name')) || await downloadFile(fileUrl=$(this).attr('data-file'))
			$(this).attr('data-token', token)
			await getDataFile(token)
		}
	} catch (error) {
		console.log(error)
	}
})
$(document).on('click', '#shareFile' ,shareFile)