import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Configuración para usar __dirname en ES Modules (ya que usas import/export)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asegurarnos de que la carpeta uploads/profiles exista
const uploadDir = path.join(__dirname, "../uploads/profiles");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); 
  },
  filename: function (req, file, cb) {
    // Nombre único para que no se sobreescriban las fotos
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('El archivo no es una imagen válida'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Límite de 2MB
  fileFilter: fileFilter
});

export default upload;