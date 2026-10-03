from rest_framework import generics

from .models import Sale
from .serializers import SaleSerializer


class SaleListCreate(generics.ListCreateAPIView):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
