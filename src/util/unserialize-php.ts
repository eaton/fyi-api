  // discuss at: http://phpjs.org/functions/unserialize/
  // original by: Arpad Ray (mailto:arpad@php.net)
  // improved by: Pedro Tainha (http://www.pedrotainha.com)
  // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // improved by: Chris
  // improved by: James
  // improved by: Le Torbi
  // improved by: Eli Skeggs
  // bugfixed by: dptr1988
  // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // bugfixed by: Brett Zamir (http://brett-zamir.me)
  //  revised by: d3x
  //    input by: Brett Zamir (http://brett-zamir.me)
  //    input by: Martin (http://www.erlenwiese.de/)
  //    input by: kilops
  //    input by: Jaroslaw Czarniak
  //        note: We feel the main purpose of this function should be to ease the transport of data between php & js
  //        note: Aiming for PHP-compatibility, we have to translate objects to arrays
  //   example 1: unserialize('a:3:{i:0;s:5:"Kevin";i:1;s:3:"van";i:2;s:9:"Zonneveld";}');
  //   returns 1: ['Kevin', 'van', 'Zonneveld']
  //   example 2: unserialize('a:3:{s:9:"firstName";s:5:"Kevin";s:7:"midName";s:3:"van";s:7:"surName";s:9:"Zonneveld";}');
  //   returns 2: {firstName: 'Kevin', midName: 'van', surName: 'Zonneveld'}

function unserialize(data: string) {
  const utf8Overhead = function(chr: string) {
    // http://phpjs.org/functions/unserialize:571#comment_95906
    var code = chr.charCodeAt(0);
    if (code < 0x0080) {
      return 0;
    }
    if (code < 0x0800) {
      return 1;
    }
    return 2;
  };

  const read_until = function(data: string, offset: number, stopchr: string) {
    let i = 2,
      buf = [],
      chr = data.slice(offset, offset + 1);

    while (chr != stopchr) {
      if ((i + offset) > data.length) {
        throw new Error('Invalid Data');
      }
      buf.push(chr);
      chr = data.slice(offset + (i - 1), offset + i);
      i += 1;
    }
    return [buf.length, buf.join('')];
  };

  const read_chrs = function(data: string, offset: number, length: number) {
    var i, chr, buf;

    buf = [];
    for (i = 0; i < length; i++) {
      chr = data.slice(offset + (i - 1), offset + i);
      buf.push(chr);
      length -= utf8Overhead(chr);
    }
    return [buf.length, buf.join('')];
  };

  const _unserialize = function(data: string, offset: number) {
    let dtype, dataoffset, keyandchrs, keys, contig,
      length, array, readdata, readData, ccount,
      stringlength, i, key, kprops, kchrs, vprops,
      vchrs, value, chrs = 0;

    let typeconvert = function(x: unknown) {
      return x;
    };

    if (!offset) {
      offset = 0;
    }
    dtype = (data.slice(offset, offset + 1))
      .toLowerCase();

    dataoffset = offset + 2;

    switch (dtype) {
    case 'i':
      typeconvert = function(x: string) {
        return parseInt(x, 10);
      };
      readData = read_until(data, dataoffset, ';');
      chrs = readData[0];
      readdata = readData[1];
      dataoffset += chrs + 1;
      break;
    case 'b':
      typeconvert = function(x) {
        return parseInt(x, 10) !== 0;
      };
      readData = read_until(data, dataoffset, ';');
      chrs = readData[0];
      readdata = readData[1];
      dataoffset += chrs + 1;
      break;
    case 'd':
      typeconvert = function(x) {
        return parseFloat(x);
      };
      readData = read_until(data, dataoffset, ';');
      chrs = readData[0];
      readdata = readData[1];
      dataoffset += chrs + 1;
      break;
    case 'n':
      readdata = null;
      break;
    case 's':
      ccount = read_until(data, dataoffset, ':');
      chrs = ccount[0];
      stringlength = ccount[1];
      dataoffset += chrs + 2;

      readData = read_chrs(data, dataoffset + 1, parseInt(stringlength, 10));
      chrs = readData[0];
      readdata = readData[1];
      dataoffset += chrs + 2;
      if (chrs != parseInt(stringlength, 10) && chrs != readdata.length) {
        error('SyntaxError', 'String length mismatch');
      }
      break;
    case 'a':
      readdata = {};

      keyandchrs = read_until(data, dataoffset, ':');
      chrs = keyandchrs[0];
      keys = keyandchrs[1];
      dataoffset += chrs + 2;

      length = parseInt(keys, 10);
      contig = true;

      for (i = 0; i < length; i++) {
        kprops = _unserialize(data, dataoffset);
        kchrs = kprops[1];
        key = kprops[2];
        dataoffset += kchrs;

        vprops = _unserialize(data, dataoffset);
        vchrs = vprops[1];
        value = vprops[2];
        dataoffset += vchrs;

        if (key !== i)
          contig = false;

        readdata[key] = value;
      }

      if (contig) {
        array = new Array(length);
        for (i = 0; i < length; i++)
          array[i] = readdata[i];
        readdata = array;
      }

      dataoffset += 1;
      break;
    default:
      throw new Error(`SyntaxError: Unknown / Unhandled data type(s): ${dtype}`);
      break;
    }
    return [dtype, dataoffset - offset, typeconvert(readdata)];
  };

  return _unserialize((data + ''), 0)[2];
}