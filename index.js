const express = require("express");
const cors = require("cors");
const app = express();
const schedule = require("node-schedule");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const Shopify = require("shopify-api-node");
const Ftp = require("ftp");
const axios = require("axios");
const port = 9000;
const FormData = require("form-data");

const ftpClient = new Ftp();
let isJobRunning = false; 
let processedFilesByMinute = new Map(); // Track processed files for each minute
let uniqueFilename;

const shopify = new Shopify({
  shopName: "cullinan-and-sons-ltd",
  accessToken: "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",
  // password: 'Cull!n@n065'
});

app.use("/uploads", express.static("uploads"));

let corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(express.json({ limit: "10mb" }));

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// database
const db = require("./app/models");

db.sequelize.sync();

// simple route
app.get("/api", (_req, res) => {
  res.json({ message: "Welcome to Backend" });
});

require("./app/routes/upload.route")(app);
require("./app/routes/auth.route")(app);
require("./app/routes/ftp.route")(app);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deleteFileFromFTP(remoteFileName) {
  ftpClient.delete(`/uploads/${remoteFileName}`, function (err) {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log("File deleted successfully");
      setTimeout(() => {
        uploadFile(remoteFileName);
        isJobRunning = false;
      }, 5000);
    }
    ftpClient.end();
    isJobRunning = false;
  });
}

async function uploadFile(remoteFileName) {
  try {
    const fileMinute = getCurrentMinute();

    console.log(remoteFileName);

    // Check if a file for the same minute has been processed before
    if (processedFilesByMinute.has(fileMinute)) {
      console.log(
        `File with minute ${fileMinute} already processed. Skipping upload for ${remoteFileName}`
      );
      return;
    }

    const formData = new FormData();
    const filePath = path.join(__dirname, "./cache/temp.csv");
    const fileStream = fs.createReadStream(filePath);

    formData.append("file", fileStream);

    const response = await axios.post(
      "http://localhost:9000/api/upload/post",
      formData,
      {
        headers: {
          ...formData.getHeaders(), // Include form data headers
        },
      }
    );
    if (response.data) {
      console.log("File uploaded successfully to API:", response.data);
      // Update uploadedMinutes set after successful upload
      processedFilesByMinute.set(fileMinute, true);
    } else {
      console.error(
        "Failed to upload file. Server responded with status:",
        response.status
      );
    }
  } catch (error) {
    console.error("Error uploading file to API:", error);
  }
}

function getCurrentMinute() {
  const now = new Date();

  const minute = now.getMinutes();
  console.log(`Current minute: ${minute}`);
  return minute;
}

//schedule.scheduleJob("*/5 * * * *", async function () {
//  let config = {
//    method: "get",
//    url: "http://localhost:9000/api/ftp/get",
//  };
//
//  let ftpData = await axios.request(config);
//  // console.log(ftpData.data)
//
//  ftpClient.connect({
//    host: ftpData.data.host,
//    user: ftpData.data.username,
//    password: ftpData.data.password,
//	secure:false
//  });
//  // console.log("ok");
//ftpClient.on("ready", function () {
//    try {
//      let remoteFileName = "";
//      ftpClient.listSafe("/uploads", function (err, list) {
//        if (err) {
//          console.error("Error listing directory:", err);
//          ftpClient.end();
//        } else {
//          console.log("Contents of the directory:", list);
//          remoteFileName = list[2].name; // Assuming you want the third item in the list
//          ftpClient.get(`/uploads/${remoteFileName}`, function (err, stream) {
//            if (err) {
//              console.error("Error downloading file:", err);
//              ftpClient.end();
//            } else {
//              console.log("File downloaded successfully from FTP");
//              // Now, stream the file directly to your API endpoint
//              fs.rmSync(path.join(__dirname, "/cache"), { recursive: true });
//              fs.mkdir(path.join(__dirname, "/cache"), (error) => {
//                if (error) {
// console.log(error);
//                } else {
//                  console.log("New Directory created successfully !!");
//                }
//              });
//              stream.pipe(
//                fs.createWriteStream(path.join(__dirname, "/cache/temp.csv"))
//              );
//              // Call uploadFile function after 5 seconds
//              setTimeout(function () {
//                uploadFile(remoteFileName);
//              }, 5000);
//            }
//          });
//        }
//      });
//    } catch (error) {
//      console.error("Error:", error.message);
//      ftpClient.end();
//    }
//  });
//});

// Schedule job to run every 5 minutes
schedule.scheduleJob("*/5 * * * *", async function () {
  //  let ftpClient = new ftp();

  if (isJobRunning) {
    console.log("Job is already running. Skipping this execution.");
    return;
  }

  isJobRunning = true;

  try {
    // Fetch FTP server credentials
    let config = {
      method: "get",
      url: "http://localhost:9000/api/ftp/get",
    };
    let ftpData = await axios.request(config);

    // Connect to the FTP server
    ftpClient.connect({
      host: ftpData.data.host,
      user: ftpData.data.username,
      password: ftpData.data.password,
      secure: false,
    });

    // Handle the FTP client ready event
    ftpClient.on("ready", function () {
      
        // // Keep-alive mechanism
        // setInterval(() => {
        //   ftpClient.send('NOOP');
        // }, 5 * 60 * 1000); // every 5 minutes

      // Keep-alive mechanism
      setInterval(() => {
        ftpClient.list('/', (err, _list) => {
          if (err) {
            console.error('Error during keep-alive request:', err);
          } else {
            console.log('Keep-alive request successful');
          }
        });
      }, 5 * 60 * 1000); // 5 minutes interval
      
      ftpClient.list("/uploads", function (err, list) {
        if (err) {
          console.error("Error listing directory:", err);
          ftpClient.end();
          isJobRunning = false;
          return;
        }

        console.log("Contents of the directory:", list);

        if (list.length < 3) {
          console.error("Not enough files in the directory");
          ftpClient.end();
          isJobRunning = false;
          return;
        }

        // Assuming you want the third item in the list
        let remoteFileName = list[2].name;

        ftpClient.get(`/uploads/${remoteFileName}`, function (err, stream) {
          if (err) {
            console.error("Error downloading file:", err);
            ftpClient.end();
            isJobRunning = false;
            return;
          }

          console.log("File downloaded successfully from FTP");

          // Clean the cache directory
          const cacheDir = path.join(__dirname, "/cache");
          if (fs.existsSync(cacheDir)) {
            fs.rmSync(cacheDir, { recursive: true, force: true });
          }

          // Create a new cache directory
          fs.mkdirSync(cacheDir, { recursive: true });
          console.log("New Directory created successfully !!");

          // Write the file to the cache directory
          const tempFilePath = path.join(cacheDir, "temp.csv");
          const fileStream = fs.createWriteStream(tempFilePath);
          stream.pipe(fileStream);

          fileStream.on("finish", () => {
            console.log("File saved to cache directory");
            // Delete file from FTP server
            deleteFileFromFTP(remoteFileName);
          });

          fileStream.on("error", (err) => {
            console.error("Error writing file:", err);
            ftpClient.end();
            isJobRunning = false;
          });
        });
      });
    });

    // Handle error event
    ftpClient.on("error", function (err) {
      console.error("FTP Client Error:", err);
      isJobRunning = false;
    });
  } catch (error) {
    console.error("Error:", error.message);
    isJobRunning = false;
  }
});

// Function to log errors to a file
// function logErrorToFile(error) {
//   const logFilePath = path.join(__dirname, "/uploads/error_log.txt");
//   const errorMessage = `${new Date().toISOString()} - ERROR: ${error}\n`;

//   fs.appendFile(logFilePath, errorMessage, (err) => {
//     if (err) {
//       console.error("Error writing to log file:", err);
//     }
//   });
// }

function logErrorToFile(error, filename) {
  const logFilePath = path.join(__dirname, `/uploads/logs/${filename}.txt`);
  const errorMessage = `${new Date().toISOString()} - ${error}\n`;

  fs.appendFile(logFilePath, errorMessage, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
    }
  });
}

async function checkIfExist(code) {
  let params = { limit: 250 };
  let pid = null;
  do {
    const products = await shopify.product.list(params);
    // console.log(JSON.stringify(products[0]))
    products.forEach(function (product, _index) {
      // console.log(product.variants[0]?.sku)
      if (product.variants[0]?.sku == code) {
        console.log(product.variants[0]?.sku);
        // console.log(product.id);
        pid = product.id;
      }
      // console.log(index)
    });
    params = products.nextPageParameters;
  } while (params != undefined);
  return pid;
}

// checkIfExist("FAI3").then((value)=>{
//   console.log(value)
// })

async function updateVariantInventoryManagement(productId) {
  const product = await shopify.product.get(productId);
  const updatedVariants = product.variants.map(variant => ({
    id: variant.id,
    inventory_management: 'shopify'
  }));

  for (const variant of updatedVariants) {
    await shopify.productVariant.update(variant.id, variant)
      .then(response => console.log(`Variant updated: ${JSON.stringify(response)}`))
      .catch(error => console.error(`Error updating variant ${variant.id}:`, error));
  }
}

schedule.scheduleJob("*/7 * * * *", function () {
  console.log("start");
  try {
    let config = {
      method: "get",
      url: "http://localhost:9000/api/upload/get",
    };

    axios
      .request(config)
      .then((response) => {


        if (!response.data || response.data.length === 0) {
          console.log("No data to process.");
          return; // Exit if the response is empty
        }else{
          
        console.log(JSON.stringify(response.data));
        const results = [];
        fs.createReadStream(
          path.join(__dirname, `./uploads/${response.data[0].filename}`)
        )
          .pipe(
            csv({
              mapHeaders: ({ header }) => {
                if (header.charCodeAt(0) === 0xfeff) {
                  header = header.substr(1);
                }
                return header;
              },
            })
          )
          .on("data", (data) => {
            uniqueFilename = response.data[0].filename.replace('.csv', '');
          
            results.push(data);
            
          })
          .on("end", async () => {
            console.log(results);

            let hasMissingFields = !(results[0].CODE && results[0].DESC);
            
            if (results.length == 0) {
              logErrorToFile(
                "ERROR: Uploaded File is Empty... Please Upload File Again...", uniqueFilename
              );
              let config = {
                method: "get",
                url: `http://localhost:9000/api/upload/putfailed/${response.data[0].id}`,
              };
              axios
                .request(config)
                .then((response1) => {
                  console.log(JSON.stringify(response1.data));
                })
                .catch((error) => {
                  console.log(error);
                });
            } else if (hasMissingFields) {
                logErrorToFile(
                    "ERROR: One or more required fields are missing in the CSV file", 
                    uniqueFilename
                );
        
                let config = {
                    method: "get",
                    url: `http://localhost:9000/api/upload/putfailed/${response.data[0].id}`,
                };
        
                // Make the API request to mark upload as failed
                axios.request(config)
                    .then((response1) => {
                        console.log(JSON.stringify(response1.data));
                    })
                    .catch((error) => {
                        console.log(error);
                    });
            }
            else {

                          let config = {
                              method: "get",
                              url: `http://localhost:9000/api/upload/putprogres/${response.data[0].id}`,
                          };
                            axios
                              .request(config)
                              .then((response1) => {
                                console.log(JSON.stringify(response1.data));
                              })
                              .catch((error) => {
                                console.log(error);
                              });


              
                    // for (let i = 0; i < results.length; i++) {
                    //     try {
                    //     let pid = await checkIfExist(results[i].CODE);
                    //         if (pid) {
                    //             shopify.product
                    //             .update(pid, {
                    //                 title: results[i].DESC,
                    //                 variants: [
                    //                 {
                    //                     barcode: results[i].BARCODE,
                    //                     inventory_quantity: parseInt(results[i].TOTALINSTK),
                    //                     price: parseFloat(results[i].SELLVAT1.trim()),
                    //                     sku: results[i].CODE,
                    //                 },
                    //                 ],
                    //                 status: results[i].STATCODE == "A" ? "active" : "draft",
                    //             })
                    //             .then((value) => {
                                    
                    //                 console.log(JSON.stringify(value));
            
                    //                 updateVariantInventoryManagement(pid);
                                    
                    //                 let data = JSON.stringify({
                    //                 metafield: {
                    //                     namespace: "custom",
                    //                     key: "landfrtcd",
                    //                     value:
                    //                     results[i].LANDFRTCD == 1
                    //                         ? "Standard"
                    //                         : results[i].LANDFRTCD == 2
                    //                         ? "Large"
                    //                         : "Bulk",
                    //                     type: "single_line_text_field",
                    //                 },
                    //                 });
            
                    //                 let config = {
                    //                 method: "post",
                    //                 url: `https://621f27ad49cc7a915cb964009fd68e40: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@cullinan-and-sons-ltd.myshopify.com/admin/api/2024-04/products/${pid}/metafields.json`,
                    //                 headers: {
                    //                     "Content-Type": "application/json",
                    //                 },
                    //                 data: data,
                    //                 };
            
                    //                 axios
                    //                 .request(config)
                    //                 .then((response) => {
                    //                     console.log(
                    //                     "meta update",
                    //                     JSON.stringify(response.data)
                    //                     );
                    //                 })
                    //                 .catch((error) => {
                    //                     console.log(error);
                    //                 });
                    //             });
                    //             logErrorToFile(
                    //                 "Success: Product Updated with SKU: " + results[i].CODE , uniqueFilename
                    //             );
                    //         } else {
                    //             shopify.product
                    //             .create({
                    //                 title: results[i].DESC,
                    //                 metafields_global_title_tag:
                    //                 results[i].LANDFRTCD == 1
                    //                     ? "Standard"
                    //                     : results[i].LANDFRTCD == 2
                    //                     ? "Large"
                    //                     : "Bulk",
                    //                 variants: [
                    //                 {
                    //                     barcode: results[i].BARCODE,
                    //                     inventory_quantity: parseInt(results[i].TOTALINSTK),
                    //                     price: parseFloat(results[i].SELLVAT1.trim()),
                    //                     sku: results[i].CODE,
                    //                 },
                    //                 ],
                    //                 status: results[i].STATCODE == "A" ? "active" : "draft",
                    //             })
                    //             .then((value) => {
                    //                 console.log(JSON.stringify(value));
            
                    //                 let data = JSON.stringify({
                    //                 metafield: {
                    //                     namespace: "custom",
                    //                     key: "landfrtcd",
                    //                     value:
                    //                     results[i].LANDFRTCD == 1
                    //                         ? "Standard"
                    //                         : results[i].LANDFRTCD == 2
                    //                         ? "Large"
                    //                         : "Bulk",
                    //                     type: "single_line_text_field",
                    //                 },
                    //                 });
            
                    //                 let config1 = {
                    //                 method: "post",
                    //                 url: `https://621f27ad49cc7a915cb964009fd68e40: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@cullinan-and-sons-ltd.myshopify.com/admin/api/2024-04/products/${value.id}/metafields.json`,
                    //                 headers: {
                    //                     "Content-Type": "application/json",
                    //                 },
                    //                 data: data,
                    //                 };
                                    
                    //                 axios
                    //                 .request(config1)
                    //                 .then((response) => {
                    //                     console.log(
                    //                     "meta add",
                    //                     JSON.stringify(response.data)
                    //                     );
                    //                 })
                    //                 .catch((error) => {
                    //                     console.log(error);
                    //                 });
                                    
                    //                 updateVariantInventoryManagement(value.id);
                    //             });
                    //             logErrorToFile(
                    //                 "Success: New Product Created with SKU : " + results[i].CODE , uniqueFilename
                    //             );
                    //         }
                    //         if(i==results.length-1){
                    //             let config = {
                    //             method: "get",
                    //             url: `http://localhost:9000/api/upload/put/${response.data[0].id}`,
                    //             };
                    //             axios
                    //             .request(config)
                    //             .then((response1) => {
                    //                 console.log(JSON.stringify(response1.data));
                    //             })
                    //             .catch((error) => {
                    //                 console.log(error);
                    //             });
                                
                    //         }
                    //     } catch (e) {
                    //           logErrorToFile("ERROR: " + e , uniqueFilename);
                    //         await sleep(15000);
                    //   }
                    // }
                    for (let i = 0; i < results.length; i++) {
                      try {
                          let pid = await checkIfExist(results[i].CODE);
                  
                          // Determine tag value based on LANDFRTCD
                          let datavalue = 
                            results[i].TAGS == 3
                            ? "Standard"
                            : results[i].TAGS == 1
                            ? "Large"
                            : results[i].TAGS == 2
                            ? "Bulk"
                            : "Unknown";
                          
                  
                          if (pid) {
                              shopify.product
                                  .update(pid, {
                                      title: results[i].DESC,
                                      variants: [
                                          {
                                              barcode: results[i].BARCODE,
                                              inventory_quantity: parseInt(results[i].TOTALINSTK),
                                              price: parseFloat(results[i].SELLVAT1.trim()),
                                              sku: results[i].CODE,
                                          },
                                      ],
                                      tags: datavalue,
                                      status: results[i].STATCODE == "A" ? "active" : "draft",
                                  })
                                  .then((value) => {
                                      console.log(JSON.stringify(value));
                                      updateVariantInventoryManagement(pid);
                                  });
                              logErrorToFile(
                                  "Success: Product Updated with SKU: " + results[i].CODE,
                                  uniqueFilename
                              );
                          } else {
                              // Product does not exist, create a new one
                              shopify.product
                                  .create({
                                      title: results[i].DESC,
                                      variants: [
                                          {
                                              barcode: results[i].BARCODE,
                                              inventory_quantity: parseInt(results[i].TOTALINSTK),
                                              price: parseFloat(results[i].SELLVAT1.trim()),
                                              sku: results[i].CODE,
                                          },
                                      ],
                                      tags: datavalue, 
                                      status: results[i].STATCODE == "A" ? "active" : "draft",
                                  })
                                  .then((value) => {
                                      console.log(JSON.stringify(value));
                                      updateVariantInventoryManagement(value.id);
                                  });
                              logErrorToFile(
                                  "Success: New Product Created with SKU: " + results[i].CODE,
                                  uniqueFilename
                              );
                          }
                  
                          if (i == results.length - 1) {
                              let config = {
                                  method: "get",
                                  url: `http://localhost:9000/api/upload/put/${response.data[0].id}`,
                              };
                              axios
                                  .request(config)
                                  .then((response1) => {
                                      console.log(JSON.stringify(response1.data));
                                  })
                                  .catch((error) => {
                                      console.log(error);
                                  });
                          }
                      } catch (e) {
                          logErrorToFile("ERROR: " + e, uniqueFilename);
                          await sleep(15000);
                      }
                  }
                  
                    
                  //   for (let i = 0; i < results.length; i++) {
                  //     try {
                  //         let pid = await checkIfExist(results[i].CODE);
                  
                  //         // Determine tag based on LANDFRTCD value
                  //         let landfrtTag =
                  //         results[i].LANDFRTCD == 3
                  //         ? "Standard"
                  //         : results[i].LANDFRTCD == 1
                  //         ? "Large"
                  //         : results[i].LANDFRTCD == 2
                  //         ? "Bulk"
                  //         : "Unknown";
                  
                  //         if (pid) {
                  //             // Fetch existing product to preserve tags
                  //             const existingProduct = await shopify.product.get(pid);
                  
                  //             // Combine existing tags with the new one, ensuring no duplicates
                  //             let updatedTags = [...new Set([...existingProduct.tags.split(", "), landfrtTag])];
                  
                  //             // Update the product
                  //             shopify.product
                  //                 .update(pid, {
                  //                     title: results[i].DESC,
                  //                     variants: [
                  //                         {
                  //                             barcode: results[i].BARCODE,
                  //                             inventory_quantity: parseInt(results[i].TOTALINSTK),
                  //                             price: parseFloat(results[i].SELLVAT1.trim()),
                  //                             sku: results[i].CODE,
                  //                         },
                  //                     ],
                  //                     status: results[i].STATCODE == "A" ? "active" : "draft",
                  //                     tags: updatedTags.join(", "), // Update tags
                  //                 })
                  //                 .then((value) => {
                  //                     console.log(JSON.stringify(value));
                  //                     updateVariantInventoryManagement(pid);
                  //                 });
                  //             logErrorToFile("Success: Product Updated with SKU: " + results[i].CODE, uniqueFilename);
                  //         } else {
                  //             // Create a new product with the appropriate tag
                  //             shopify.product
                  //                 .create({
                  //                     title: results[i].DESC,
                  //                     tags: landfrtTag, // Assign tag during creation
                  //                     variants: [
                  //                         {
                  //                             barcode: results[i].BARCODE,
                  //                             inventory_quantity: parseInt(results[i].TOTALINSTK),
                  //                             price: parseFloat(results[i].SELLVAT1.trim()),
                  //                             sku: results[i].CODE,
                  //                         },
                  //                     ],
                  //                     status: results[i].STATCODE == "A" ? "active" : "draft",
                  //                 })
                  //                 .then((value) => {
                  //                     console.log(JSON.stringify(value));
                  //                     updateVariantInventoryManagement(value.id);
                  //                 });
                  //             logErrorToFile("Success: New Product Created with SKU : " + results[i].CODE, uniqueFilename);
                  //         }
                  
                  //         if (i == results.length - 1) {
                  //             let config = {
                  //                 method: "get",
                  //                 url: `http://localhost:9000/api/upload/put/${response.data[0].id}`,
                  //             };
                  //             axios
                  //                 .request(config)
                  //                 .then((response1) => {
                  //                     console.log(JSON.stringify(response1.data));
                  //                 })
                  //                 .catch((error) => {
                  //                     console.log(error);
                  //                 });
                  //         }
                  //     } catch (e) {
                  //         logErrorToFile("ERROR: " + e, uniqueFilename);
                  //         await sleep(15000);
                  //     }
                  // }
                  
            }
        });
      }

        
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (e) {
    console.log("Error", e);
  }
});

process.on("uncaughtException", function (err) {
  console.error(err);
  console.log("Restarting...");
});
// set port, listen for requests
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
