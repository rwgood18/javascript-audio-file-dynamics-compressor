// Web Audio
var audioCtx = new (AudioContext || webkitAudioContext)();
    
// Compressed audio data array
var chunks = [];

var fileInput = document.getElementById('audio-file');
var compress_btn = document.getElementById('compress_btn');

var loud = [-10, 20, 5, .050, .25];
var louder = [-20, 40, 10, .040, .25];
var loudest = [-40, 40, 20, .030, .25];
var comp_config;

$("[name='level']").click(function() {
  if($(this).attr('id') != 'custom') {
    $('#custom1').addClass('d-none');
  } else {
    $('#custom1').removeClass('d-none');
  }
})
//Load audio file listener
compress_btn.addEventListener("click", function() {
  
  // Reset buttons and log
  $("#log").empty();
  $('#download_link').addClass('d-none');
  $('#repeat_link').addClass('d-none');

  // Check for file
  if(fileInput.files[0] == undefined) {

    if($('#upload_err').hasClass('d-none')) {
      $('#upload_err').removeClass('d-none');
    }
    return false;
  }

  var comp_level = $("input[name='level']:checked").attr('id');
  // console.log("Comp level = " + comp_level);

  switch(comp_level) {
    case 'loud':
      comp_config = loud;
      break;
    case 'louder':
      comp_config = louder;
      break;
    case 'loudest':
      comp_config = loudest;
      break;
    case 'custom':
      var custom_settings = [];
      
      $("[name='setting']").each(function() {
        // console.log("pushing " + $(this).val());
        custom_settings.push($(this).val());
      });
      comp_config = custom_settings;
      break;
    default:
      comp_config = louder;
      break;
  }
  var reader1 = new FileReader();

  reader1.onload = function(ev) {
    // console.log("Reader loaded.");

    tempBuffer = audioCtx.createBufferSource();
    
    // Decode audio
    audioCtx.decodeAudioData(ev.target.result).then(function(buffer) {
     // console.log("Duration1 = " + buffer.duration);
     

        offlineAudioCtx = new OfflineAudioContext({
          numberOfChannels: 2,
          length: 44100 * buffer.duration,
          sampleRate: 44100,
        });
        // console.log("test 1");
        // Audio Buffer Source
        soundSource = offlineAudioCtx.createBufferSource();
        // console.log("test 2");

        // Compressor Node
        compressor = offlineAudioCtx.createDynamicsCompressor();
        // console.log("test 3");

        compressor.threshold.setValueAtTime(comp_config[0], offlineAudioCtx.currentTime);
        compressor.knee.setValueAtTime(comp_config[1], offlineAudioCtx.currentTime);
        compressor.ratio.setValueAtTime(comp_config[2], offlineAudioCtx.currentTime);
        compressor.attack.setValueAtTime(comp_config[3], offlineAudioCtx.currentTime);
        compressor.release.setValueAtTime(comp_config[4], offlineAudioCtx.currentTime);
        // console.log("test 4");

        // Gain Node
        gainNode = offlineAudioCtx.createGain();
        gainNode.gain.setValueAtTime(1, offlineAudioCtx.currentTime);

        var reader2 = new FileReader();

        // console.log("Created Reader");

        reader2.onload = function(ev) {

            // console.log("Reading audio data to buffer...");
            $("#log").append("<p>Buffering...</p>");


            soundSource.buffer = buffer;
            compressor.buffer = buffer;

            soundSource.connect(compressor);
            
            compressor.connect(gainNode);
            // console.log("Compressing audio...");
            $("#log").append("<p>Compressing...</p>");

            gainNode.connect(offlineAudioCtx.destination);

            offlineAudioCtx.startRendering().then(function(renderedBuffer) {
              // console.log('Rendering completed successfully.');
              $("#log").append("<p>Rendering new file...</p>");
                  
              var song = offlineAudioCtx.createBufferSource();

              // console.log('OfflineAudioContext.length = ' + offlineAudioCtx.length);
              
              split(renderedBuffer, offlineAudioCtx.length);

              $("#log").append("<p>Finished!</p>");

            }).catch(function(err) {
              // console.log('Rendering failed: ' + err);
              $("#log").append("<p>Rendering failed.</p>");
            });

            soundSource.loop = false;
        };
        reader2.readAsArrayBuffer(fileInput.files[0]);
        soundSource.start(0);
    
    });

  };

  reader1.readAsArrayBuffer(fileInput.files[0]);

}, false);

//Convert to Wav functions

//Split the buffer
function split(abuffer, total_samples) {

  // calc number of segments and segment length
  var channels = abuffer.numberOfChannels,
      duration = abuffer.duration,
      rate = abuffer.sampleRate,
      offset = 0;

  var new_file = URL.createObjectURL(bufferToWave(abuffer, offset, total_samples));

  var download_link = document.getElementById("download_link");
  download_link.href = new_file;
  var name = generateFileName();
  download_link.download = name;

  $('#download_link').toggleClass('d-none');
  $('#repeat_link').toggleClass('d-none');
}

// Convert a audio-buffer segment to a Blob using WAVE representation
// Adapted from this answer: https://stackoverflow.com/questions/29584420/how-to-manipulate-the-contents-of-an-audio-tag-and-create-derivative-audio-tags
function bufferToWave(abuffer, offset, len) {
  var numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [], i, sample,
      pos = 0;

  // write WAVE header - total offset will be 44 bytes - see chart at http://soundfile.sapp.org/doc/WaveFormat/
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this demo)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < length) {
    for(i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // update data chunk
      pos += 2;
    }
    offset++                                     // next source sample
  }

  // create Blob
  return new Blob([buffer], {type: "audio/wav"});

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

function generateFileName() {
  var origin_name = fileInput.files[0].name;
  var pos = origin_name.lastIndexOf('.');
  var no_ext = origin_name.slice(0, pos);

  return no_ext + ".compressed.wav";
}