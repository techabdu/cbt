<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'name'      => ['required', 'string', 'max:255'],
            'code'      => ['required', 'string', 'max:30',
                Rule::unique('departments', 'code')->where('school_id', $schoolId)],
            'full_name' => ['nullable', 'string', 'max:500'],
        ];
    }
}
