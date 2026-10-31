
import torch
from torchvision import transforms
from PIL import Image
from functools import lru_cache

DEVICE = torch.device("cpu")

MODEL_NAME = "dinov2_vits14"

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


@lru_cache(maxsize=1)
def get_meta_model():
    model = torch.hub.load(
        "facebookresearch/dinov2",
        MODEL_NAME,
        trust_repo=True,
    )
    return model.to(DEVICE).eval()


@torch.inference_mode()
def extract_meta_features(images):
    model = get_meta_model()

    batch = torch.stack([
        transform(image.convert("RGB"))
        for image in images
    ]).to(DEVICE)

    embeddings = model(batch)

    return embeddings.cpu().numpy()


if __name__ == "__main__":
    image = Image.new("RGB", (224, 224), "white")

    features = extract_meta_features([image])

    print("Model:", MODEL_NAME)
    print("Embedding shape:", features.shape)
    print("Device:", DEVICE)
