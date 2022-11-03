var dropZone = document.getElementById('dropzone');

function showDropZone() {
	dropZone.style.display = "block";
}
function hideDropZone() {
    dropZone.style.display = "none";
}

function allowDrag(ev) {
  if (true) {  // Test that the item being dragged is a valid one
      ev.dataTransfer.dropEffect = 'copy';
      ev.preventDefault();
  }
}

// Convert file to base64 string
const fileToBase64 = (file) => {
  return new Promise(resolve => {
    var reader = new FileReader();
    // Read file content on file loaded event
    reader.onload = function(event) {
      resolve(event.target.result);
    };
    
    // Convert data to base64 
    reader.readAsDataURL(file);
  });
};

function dropHandler(ev) {
  console.log('File(s) dropped');

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
  hideDropZone();

  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    [...ev.dataTransfer.items].forEach((item, i) => {
      // If dropped items aren't files, reject them
      if (item.kind === 'file') {
        const file = item.getAsFile();
        console.log(`… file[${i}].name = ${file.name}`);
        console.log(`… file[${i}].size = ${file.size}`);
        if (file.size < 32000000) {
          fileToBase64(file).then(result => {
            console.log(result);
          });
        }
        else {
          alert('File must be smaller than 32MB!!');
        }
      }
    });
  } else {
    // Use DataTransfer interface to access the file(s)
    [...ev.dataTransfer.files].forEach((file, i) => {
      console.log(`… file[${i}].name = ${file.name}`);
      console.log(`… file[${i}].size = ${file.size}`);
        if (file.size < 32000000) {
          fileToBase64(file).then(result => {
            console.log(result);
          });
        }
        else {
          alert('File must be smaller than 32MB!!');
        }
    });
  }
}

// 1
window.addEventListener('dragenter', function(e) {
  showDropZone();
});

// 2
dropZone.addEventListener('dragenter', allowDrag);
dropZone.addEventListener('dragover', allowDrag);

// 3
dropZone.addEventListener('dragleave', function(ev) {
	console.log('dragleave');
    hideDropZone();
});

// 4
dropZone.addEventListener('drop', dropHandler);


